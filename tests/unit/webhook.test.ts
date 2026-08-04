import { readFileSync } from "node:fs";
import path from "node:path";

import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Le webhook est la seule preuve de paiement
 *
 * La redirection de retour est déclenchée par un navigateur : falsifiable, et
 * absente dès que quelqu'un ferme l'onglet. Activer dessus ouvrirait le jeu à
 * qui devine l'adresse de succès, et le fermerait à qui a payé.
 * ====================================================================== */

/* ---------------------------------------------------------------------------
 * Un faux client Supabase, pour éprouver l'idempotence pour de vrai
 * ------------------------------------------------------------------------ */

type FakeState = {
  tier: { donated_cents: number; price_cents: number } | null;
  paymentError: { code: string } | null;
  activatedRows: Array<{ id: string }>;
  activationError: { code: string } | null;
  inserted: Array<Record<string, unknown>>;
  updated: Array<Record<string, unknown>>;
};

const state: FakeState = {
  tier: null,
  paymentError: null,
  activatedRows: [],
  activationError: null,
  inserted: [],
  updated: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "registration_tiers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.tier }) }),
          }),
        };
      }

      if (table === "payments") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.inserted.push(row);
            return { error: state.paymentError };
          },
        };
      }

      if (table === "registrations") {
        return {
          update: (patch: Record<string, unknown>) => {
            state.updated.push(patch);
            return {
              eq: () => ({
                eq: () => ({
                  select: async () => ({
                    data: state.activatedRows,
                    error: state.activationError,
                  }),
                }),
              }),
            };
          },
        };
      }

      throw new Error(`table inattendue : ${table}`);
    },
  }),
}));

const { handleCheckoutCompleted, readReferences, splitAmounts } =
  await import("@/lib/registration/activation");
const { verifyStripeSignature } = await import("@/lib/stripe/webhook");

type Session = Parameters<typeof handleCheckoutCompleted>[0];

function session(overrides: Record<string, unknown> = {}): Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 3500,
    payment_intent: "pi_test_123",
    client_reference_id: "registration-uuid",
    metadata: {
      registration_id: "registration-uuid",
      profile_id: "profile-uuid",
      edition_id: "edition-uuid",
      tier_id: "tier-uuid",
    },
    ...overrides,
  } as unknown as Session;
}

beforeEach(() => {
  state.tier = { donated_cents: 2000, price_cents: 3500 };
  state.paymentError = null;
  state.activatedRows = [{ id: "registration-uuid" }];
  state.activationError = null;
  state.inserted = [];
  state.updated = [];

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* ---------------------------------------------------------------------------
 * La signature
 * ------------------------------------------------------------------------ */

describe("la signature du webhook", () => {
  const SECRET = "whsec_test_secret_pour_les_tests";
  const stripe = new Stripe("sk_test_pour_les_tests");
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123" } },
  });

  const sign = (body: string, secret = SECRET, timestamp?: number) =>
    stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret,
      ...(timestamp === undefined ? {} : { timestamp }),
    });

  it("accepte un appel réellement signé", async () => {
    const checked = await verifyStripeSignature(
      payload,
      sign(payload),
      stripe,
      SECRET,
    );

    expect(checked.ok).toBe(true);
    if (checked.ok)
      expect(checked.event.type).toBe("checkout.session.completed");
  });

  it("refuse un corps modifié après signature", async () => {
    // C'est pour cela que la route lit le texte brut : reformater le JSON
    // change les octets, et la signature ne correspond plus.
    const signature = sign(payload);
    const altered = payload.replace("cs_test_123", "cs_test_999");

    expect(
      await verifyStripeSignature(altered, signature, stripe, SECRET),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse une signature faite avec un autre secret", async () => {
    const signature = sign(payload, "whsec_autre_secret_completement");

    expect(
      await verifyStripeSignature(payload, signature, stripe, SECRET),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse une signature trop ancienne", async () => {
    // Sans fenêtre de tolérance, un appel légitime capté une fois pourrait
    // être rejoué indéfiniment.
    const old = Math.floor(Date.now() / 1000) - 3600;

    expect(
      await verifyStripeSignature(
        payload,
        sign(payload, SECRET, old),
        stripe,
        SECRET,
      ),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse un appel sans signature du tout", async () => {
    expect(await verifyStripeSignature(payload, null, stripe, SECRET)).toEqual({
      ok: false,
      reason: "no-signature",
    });
  });

  it("refuse tout quand le secret n’est pas configuré", async () => {
    // Plutôt que d'accepter « puisqu'on ne peut pas vérifier ». Un webhook
    // non vérifié est une route qui active des inscriptions sur demande.
    expect(
      await verifyStripeSignature(payload, sign(payload), stripe, undefined),
    ).toEqual({ ok: false, reason: "not-configured" });
  });
});

/* ---------------------------------------------------------------------------
 * Les montants
 * ------------------------------------------------------------------------ */

describe("la répartition du montant", () => {
  it("sépare le don de la contrepartie", () => {
    expect(splitAmounts(3500, 2000)).toEqual({
      donation_cents: 2000,
      counterpart_cents: 1500,
    });
  });

  it("ne laisse jamais la somme dépasser l’encaissement", () => {
    // La base l'interdit par contrainte ; ici on s'assure que la contrainte
    // ne sera jamais atteinte, plutôt que de découvrir l'erreur au moment où
    // Stripe attend une réponse.
    const { donation_cents, counterpart_cents } = splitAmounts(1000, 5000);

    expect(donation_cents).toBe(1000);
    expect(counterpart_cents).toBe(0);
  });

  it("supporte un tarif sans don déclaré", () => {
    expect(splitAmounts(3500, 0)).toEqual({
      donation_cents: 0,
      counterpart_cents: 3500,
    });
  });
});

describe("les références portées par la session", () => {
  it("les lit sur la session", () => {
    expect(readReferences(session())).toEqual({
      registrationId: "registration-uuid",
      profileId: "profile-uuid",
      editionId: "edition-uuid",
      tierId: "tier-uuid",
    });
  });

  it("retombe sur les métadonnées si la référence directe manque", () => {
    expect(
      readReferences(session({ client_reference_id: null })).registrationId,
    ).toBe("registration-uuid");
  });

  it("ne devine rien quand il n’y a rien", () => {
    const empty = readReferences(
      session({ client_reference_id: null, metadata: {} }),
    );

    expect(empty.registrationId).toBe(null);
    expect(empty.profileId).toBe(null);
  });
});

/* ---------------------------------------------------------------------------
 * Le traitement
 * ------------------------------------------------------------------------ */

describe("le traitement d’un paiement confirmé", () => {
  it("crée la ligne comptable et active l’inscription", async () => {
    const result = await handleCheckoutCompleted(session());

    expect(result).toEqual({ ok: true, outcome: "activated" });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      registration_id: "registration-uuid",
      stripe_session_id: "cs_test_123",
      stripe_payment_intent_id: "pi_test_123",
      gross_cents: 3500,
      donation_cents: 2000,
      counterpart_cents: 1500,
      kind: "registration",
    });
    expect(state.updated[0]).toMatchObject({ status: "active" });
  });

  it("laisse les frais inconnus plutôt que de les inventer", () => {
    // Stripe ne connaît pas encore la commission à cet instant. `null` veut
    // dire « pas encore su » ; zéro serait un mensonge que la comptabilité
    // reprendrait à son compte. La story 2.6 la relit pour de vrai.
    expect(code("src/lib/registration/activation.ts")).toMatch(
      /fee_cents:\s*null/,
    );
  });

  it("ne rejoue pas la ligne comptable", async () => {
    // Stripe renvoie tout ce qui n'a pas répondu 200 en quelques secondes, et
    // envoie plusieurs événements pour un même paiement. C'est la base qui
    // refuse le doublon, pas un `if`.
    state.paymentError = { code: "23505" };
    state.activatedRows = [];

    const result = await handleCheckoutCompleted(session());

    expect(result).toEqual({ ok: true, outcome: "already-processed" });
    expect(state.updated).toHaveLength(1);
  });

  it("active quand même après une première livraison morte en chemin", async () => {
    // Le cas qui coûte cher : la ligne comptable est passée, l'activation
    // non. Si le rejeu s'arrêtait au doublon, quelqu'un qui a payé resterait
    // dehors définitivement.
    state.paymentError = { code: "23505" };
    state.activatedRows = [{ id: "registration-uuid" }];

    expect(await handleCheckoutCompleted(session())).toEqual({
      ok: true,
      outcome: "activated",
    });
  });

  it("demande à Stripe de réessayer quand l’écriture échoue", async () => {
    // Répondre 200 pour « ne pas embêter Stripe » ferait perdre le paiement
    // définitivement : Stripe considère l'affaire close.
    state.paymentError = { code: "40001" };

    const result = await handleCheckoutCompleted(session());

    expect(result.ok).toBe(false);
    expect(state.updated).toHaveLength(0);
  });

  it("demande à réessayer quand l’activation échoue", async () => {
    state.activationError = { code: "57014" };

    expect((await handleCheckoutCompleted(session())).ok).toBe(false);
  });

  it("n’active rien sur une session non payée", async () => {
    const result = await handleCheckoutCompleted(
      session({ payment_status: "unpaid" }),
    );

    expect(result).toEqual({ ok: true, outcome: "ignored" });
    expect(state.inserted).toHaveLength(0);
  });

  it("n’invente pas d’inscription quand les références manquent", async () => {
    const result = await handleCheckoutCompleted(
      session({ client_reference_id: null, metadata: {} }),
    );

    // Traité, pas en échec : réessayer n'ajoutera pas des références qui
    // n'ont jamais existé. Le journal, lui, le dit fort.
    expect(result).toEqual({ ok: true, outcome: "ignored" });
    expect(state.inserted).toHaveLength(0);
  });

  it("refuse une session sans montant", async () => {
    expect(
      (await handleCheckoutCompleted(session({ amount_total: null }))).ok,
    ).toBe(false);
  });

  it("encaisse ce qui a été payé, pas ce qui était affiché", async () => {
    // Si le tarif a bougé entre la session et le paiement, la comptabilité
    // suit l'argent.
    state.tier = { donated_cents: 2000, price_cents: 4000 };

    await handleCheckoutCompleted(session({ amount_total: 3500 }));

    expect(state.inserted[0]).toMatchObject({ gross_cents: 3500 });
  });
});

/* ---------------------------------------------------------------------------
 * La route
 * ------------------------------------------------------------------------ */

describe("la route du webhook", () => {
  const route = code("src/app/api/webhooks/stripe/route.ts");

  it("lit le corps brut, jamais du JSON reparsé", () => {
    expect(route).toMatch(/request\.text\(\)/);
    expect(route).not.toMatch(/request\.json\(\)/);
  });

  it("vérifie la signature avant de regarder le contenu", () => {
    // Mesuré dans le corps de la fonction : les imports en haut du fichier
    // citent les deux noms dans l'ordre alphabétique, qui ne dit rien.
    const body = route.slice(route.indexOf("export async function POST"));

    const verifyAt = body.indexOf("verifyStripeSignature");
    const handleAt = body.indexOf("handleCheckoutCompleted");

    expect(verifyAt).toBeGreaterThan(-1);
    expect(handleAt).toBeGreaterThan(verifyAt);
  });

  it("refuse une signature invalide sans se justifier", () => {
    expect(route).toMatch(/status:\s*400/);
  });

  it("renvoie une erreur quand le traitement échoue", () => {
    expect(route).toMatch(/status:\s*500/);
  });

  it("tourne sur Node, où la vérification de signature est possible", () => {
    expect(route).toMatch(/runtime = "nodejs"/);
  });

  it("est exclue du middleware de session", () => {
    // Elle s'authentifie par signature. Un rafraîchissement de session ici
    // serait un aller-retour pour personne.
    expect(code("src/middleware.ts")).toContain("api/webhooks");
  });
});

/* ---------------------------------------------------------------------------
 * L'accès au jeu
 * ------------------------------------------------------------------------ */

describe("l’accès au jeu", () => {
  it("est refusé tant que l’inscription n’est pas active", () => {
    const layout = code("src/app/(participant)/jeu/layout.tsx");

    expect(layout).toMatch(/getParticipantAccess\(\)/);
    expect(layout).toMatch(/isActive[\s\S]{0,80}redirect\(/);
  });

  it("se décide par la sécurité de la base, pas par la clé de service", () => {
    // La clé de service contournerait les règles, et ce fichier deviendrait
    // la seule protection du jeu — une protection qui ne tient que tant que
    // chaque page future pense à l'appeler.
    const access = code("src/lib/registration/access.ts");

    expect(access).not.toMatch(/createAdminClient/);
    expect(access).toMatch(/from "@\/lib\/supabase\/server"/);
  });

  it("ne confond pas « pas en attente » avec « payé »", () => {
    // Une inscription remboursée ou annulée n'est pas `pending` non plus, et
    // ne doit rien ouvrir.
    expect(code("src/lib/registration/access.ts")).toMatch(
      /status === "active"/,
    );
  });
});
