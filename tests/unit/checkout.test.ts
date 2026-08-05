import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkoutReturnUrls,
  createCheckoutSession,
} from "@/lib/registration/checkout";
import type { RegistrationTier } from "@/lib/registration/tiers";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const TIER: RegistrationTier = {
  id: "tier-uuid",
  slug: "sportif",
  name: "Sportif",
  priceCents: 3500,
  donatedCents: 2000,
  tagline: "Le niveau conseillé",
  perks: ["Une médaille"],
  featured: true,
  requiresShipping: true,
};

const REQUEST = {
  registrationId: "registration-uuid",
  profileId: "profile-uuid",
  editionId: "edition-uuid",
  tier: TIER,
  email: "participant@exemple.fr",
};

/** Ce que l'on envoie à Stripe, vu du test. */
type SessionParams = {
  mode: string;
  locale: string;
  client_reference_id: string;
  line_items: Array<{
    quantity: number;
    price_data: { currency: string; unit_amount: number };
  }>;
  metadata: Record<string, string>;
  payment_intent_data: { metadata: Record<string, string> };
  success_url: string;
  cancel_url: string;
};

/** A Stripe stand-in that records what it was asked to create. */
function stubStripe(
  response: { id: string; url: string | null } | Error = {
    id: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  },
) {
  const seen: SessionParams[] = [];

  const create = vi.fn(async (params: SessionParams) => {
    seen.push(params);
    if (response instanceof Error) throw response;
    return response;
  });

  return {
    client: { checkout: { sessions: { create } } },
    create,
    /** What Stripe was asked for, on the first call. */
    params: () => seen[0],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asStripe = (client: unknown) => client as any;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://defi-movember.fr");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("les adresses de retour", () => {
  it("viennent de la configuration, pas de la requête", () => {
    // La story 1.4 a payé ce défaut sur la confirmation d'e-mail : le serveur
    // autonome de Next renvoie l'adresse à laquelle le conteneur est attaché
    // — `0.0.0.0:3000` — et non celle du visiteur. Et `X-Forwarded-Host` est
    // un en-tête, donc envoyé par n'importe qui : un retour de paiement bâti
    // dessus renverrait le participant où l'attaquant veut.
    const { successUrl, cancelUrl } = checkoutReturnUrls("sportif");

    expect(successUrl).toMatch(/^https:\/\/defi-movember\.fr\//);
    expect(cancelUrl).toMatch(/^https:\/\/defi-movember\.fr\//);
  });

  it("laissent Stripe substituer l’identifiant de session", () => {
    // Encodé, le gabarit ne serait pas reconnu et l'adresse de retour
    // contiendrait littéralement « %7BCHECKOUT_SESSION_ID%7D ».
    expect(checkoutReturnUrls("sportif").successUrl).toContain(
      "{CHECKOUT_SESSION_ID}",
    );
  });

  it("échappent le niveau", () => {
    expect(checkoutReturnUrls("a/b").successUrl).toContain("a%2Fb");
  });

  it("distinguent le retour d’un abandon", () => {
    const { successUrl, cancelUrl } = checkoutReturnUrls("sportif");

    expect(successUrl).toContain("statut=succes");
    expect(cancelUrl).toContain("statut=abandon");
  });
});

describe("la création de la session de paiement", () => {
  it("prend le montant en base, jamais dans la requête", async () => {
    // C'est la faille classique du paiement en ligne : un prix transmis par
    // le navigateur est un prix choisi par le navigateur. L'action reçoit un
    // identifiant de niveau ; le montant est relu.
    const { client, params } = stubStripe();

    const outcome = await createCheckoutSession(REQUEST, asStripe(client));

    expect(outcome.ok).toBe(true);
    const sent = params()!;

    expect(sent.line_items).toHaveLength(1);
    expect(sent.line_items[0]!.price_data.unit_amount).toBe(3500);
    expect(sent.line_items[0]!.price_data.currency).toBe("eur");
    expect(sent.line_items[0]!.quantity).toBe(1);
  });

  it("rattache la session à l’inscription", async () => {
    const { client, params } = stubStripe();

    await createCheckoutSession(REQUEST, asStripe(client));
    const sent = params()!;

    expect(sent.client_reference_id).toBe("registration-uuid");
    expect(sent.metadata).toMatchObject({
      registration_id: "registration-uuid",
      profile_id: "profile-uuid",
      edition_id: "edition-uuid",
      tier_id: "tier-uuid",
    });
  });

  it("porte les références sur le paiement aussi, pas seulement sur la session", async () => {
    // La ligne comptable (story 2.6) et le remboursement (story 2.8) partent
    // du paiement. Sans ces références, il faudrait remonter à la session
    // pour savoir qui a payé quoi.
    const { client, params } = stubStripe();

    await createCheckoutSession(REQUEST, asStripe(client));

    expect(params()!.payment_intent_data.metadata).toMatchObject({
      registration_id: "registration-uuid",
    });
  });

  it("passe par les pages hébergées de Stripe", async () => {
    // NFR14 : aucune donnée de carte ne transite par l'application. C'est
    // `mode: payment` sur une session hébergée qui le garantit — on reçoit
    // une adresse, rien d'autre.
    const { client, params } = stubStripe();

    const outcome = await createCheckoutSession(REQUEST, asStripe(client));

    expect(params()!.mode).toBe("payment");
    expect(params()!.locale).toBe("fr");
    if (outcome.ok) {
      expect(outcome.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    }
  });

  it.each([
    ["un montant nul", 0],
    ["un montant négatif", -100],
    ["un montant décimal", 35.5],
  ])("refuse %s sans même appeler Stripe", async (_label, priceCents) => {
    const { client, create } = stubStripe();

    const outcome = await createCheckoutSession(
      { ...REQUEST, tier: { ...TIER, priceCents } },
      asStripe(client),
    );

    expect(outcome.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuse quand Stripe n’est pas configuré", async () => {
    const outcome = await createCheckoutSession(REQUEST, null);

    expect(outcome).toEqual({ ok: false, reason: "stripe-unavailable" });
  });

  it("refuse une session sans adresse", async () => {
    const { client } = stubStripe({ id: "cs_test_123", url: null });

    expect(await createCheckoutSession(REQUEST, asStripe(client))).toEqual({
      ok: false,
      reason: "no-url",
    });
  });

  it("ne laisse pas remonter le message d’erreur de Stripe", async () => {
    // Les erreurs de Stripe sont en anglais et mentionnent parfois du détail
    // interne. Le participant reçoit une phrase qui lui dit quoi faire.
    const { client } = stubStripe(new Error("No such price: price_1234"));

    const outcome = await createCheckoutSession(REQUEST, asStripe(client));

    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toMatch(/No such price/);
  });
});

describe("la clé secrète", () => {
  it("reste côté serveur", () => {
    // `server-only` fait échouer la construction si un composant client
    // importe ce module. Un commentaire « ne pas importer côté client »
    // n'aurait arrêté personne.
    expect(code("src/lib/stripe/client.ts")).toMatch(/^import "server-only";/m);
    expect(code("src/lib/registration/checkout.ts")).toMatch(
      /^import "server-only";/m,
    );
  });

  it("n’est jamais exposée au navigateur", () => {
    const client = code("src/lib/stripe/client.ts");

    expect(client).toContain("STRIPE_SECRET_KEY");
    expect(client).not.toMatch(/NEXT_PUBLIC_STRIPE_SECRET/);
    // Une variable préfixée `NEXT_PUBLIC_` est inlinée dans le bundle client
    // par Next : le préfixe et le mot « secret » ne doivent jamais se croiser.
    expect(client).not.toMatch(/NEXT_PUBLIC_\w*SECRET/);
  });

  it("refuse une clé de production hors production", async () => {
    // Préproduction et production sont la même application, distinguées par
    // leur seule configuration. Le jour où la mauvaise clé est copiée sur le
    // serveur de préproduction, une inscription de test débiterait une vraie
    // carte.
    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_exemple");
    vi.stubEnv("APP_ENVIRONMENT", "staging");

    const { stripeClient } = await import("@/lib/stripe/client");

    expect(stripeClient()).toBe(null);
  });

  it("refuse aussi une clé absente", async () => {
    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const { stripeClient } = await import("@/lib/stripe/client");

    expect(stripeClient()).toBe(null);
  });
});

describe("le tunnel d’inscription", () => {
  const actions = code("src/lib/registration/actions.ts");

  it("ne lit aucun montant dans le formulaire", () => {
    // Le formulaire n'envoie qu'un identifiant de niveau. Tout le reste est
    // relu en base.
    expect(actions).not.toMatch(/formData\.get\("(price|amount|montant|prix)/);
  });

  it("crée l’inscription avant d’envoyer vers le paiement", () => {
    // Sans cette trace, quelqu'un qui abandonne à mi-parcours ne laisse rien
    // derrière lui, et on n'a rien à répondre quand il écrit « j'ai payé et
    // je n'ai rien reçu ».
    const insertAt = actions.indexOf('.from("registrations")');
    const handoffAt = actions.indexOf("paymentHandoff({");

    expect(insertAt).toBeGreaterThan(-1);
    expect(handoffAt).toBeGreaterThan(insertAt);
  });

  it("relit le niveau sur l’inscription pour reprendre un paiement", () => {
    // Quelqu'un qui a choisi « Sportif légendaire », est parti, et revient,
    // est débité de ce qu'il a choisi — et une requête forgée ne peut pas y
    // substituer le niveau le moins cher au retour.
    expect(actions).toMatch(/getTierById\(registration\.tier_id\)/);
  });

  it("refuse de créer une session pour un participant déjà actif", () => {
    const resume = actions.slice(
      actions.indexOf("export async function resumeCheckout"),
    );

    expect(resume).toMatch(
      /status === "active"[\s\S]{0,80}redirect\(ROUTES\.account\)/,
    );
  });
});

describe("la page de retour", () => {
  const page = code(
    "src/app/(participant)/participer/[niveau]/paiement/page.tsx",
  );

  it("n’annonce jamais un succès sur la foi de l’adresse", () => {
    // `?statut=succes` dit seulement que Stripe a redirigé ici, et n'importe
    // qui peut le taper. Ce qui décide est le statut de l'inscription, que
    // seul le webhook change. Une page qui félicite avant confirmation
    // félicitera un jour quelqu'un dont la carte a été refusée.
    expect(page).toMatch(/status === "active"/);
    expect(page).toMatch(/confirmation en cours/i);
  });

  it("dit que rien n’a été prélevé après un abandon", () => {
    expect(page).toMatch(/Rien n’a été prélevé/);
  });
});
