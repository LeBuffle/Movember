import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260805110000_refunds.sql"),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Un remboursement est un second mouvement
 *
 * Jamais une correction du premier. C'est ce que fait un livre de comptes, et
 * c'est ce qui permet le rapprochement avec le relevé Stripe — qui procède
 * exactement pareil.
 * ====================================================================== */

type FakeState = {
  payment: {
    id: string;
    registration_id: string | null;
    profile_id: string | null;
    edition_id: string;
    gross_cents: number;
  } | null;
  readError: { code: string } | null;
  insertError: { code: string } | null;
  statusError: { code: string } | null;
  inserted: Array<Record<string, unknown>>;
  statusUpdates: Array<Record<string, unknown>>;
};

const state: FakeState = {
  payment: null,
  readError: null,
  insertError: null,
  statusError: null,
  inserted: [],
  statusUpdates: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "payments") {
        const query = {
          neq: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: state.payment,
            error: state.readError,
          }),
        };

        return {
          select: () => query,
          insert: async (row: Record<string, unknown>) => {
            state.inserted.push(row);
            return { error: state.insertError };
          },
        };
      }

      if (table === "registrations") {
        return {
          update: (patch: Record<string, unknown>) => {
            state.statusUpdates.push(patch);
            return {
              eq: () => ({
                eq: async () => ({ error: state.statusError }),
              }),
            };
          },
        };
      }

      throw new Error(`table inattendue : ${table}`);
    },
  }),
}));

const { recordRefund } = await import("@/lib/accounting/refund");

beforeEach(() => {
  state.payment = {
    id: "payment-uuid",
    registration_id: "registration-uuid",
    profile_id: "profile-uuid",
    edition_id: "edition-uuid",
    gross_cents: 3500,
  };
  state.readError = null;
  state.insertError = null;
  state.statusError = null;
  state.inserted = [];
  state.statusUpdates = [];

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const REFUND = {
  refundId: "re_test_1",
  chargeId: "ch_test_1",
  paymentIntentId: "pi_test_1",
  amountCents: 3500,
};

describe("la base garantit qu’un remboursement ne se rejoue pas", () => {
  it("donne au remboursement son propre identifiant, unique", () => {
    // La ligne d'encaissement possède déjà l'identifiant du paiement, et il
    // est unique : la ligne de remboursement ne peut pas le porter aussi.
    expect(migration).toMatch(/add column if not exists stripe_refund_id/);
    expect(migration).toMatch(
      /create unique index[\s\S]*?payments_refund_unique[\s\S]*?stripe_refund_id/i,
    );
  });

  it("exige cet identifiant sur un remboursement, et l’interdit ailleurs", () => {
    // Sans quoi une ligne écrite à la main sans identifiant échapperait à
    // l'index unique — la seule garde qui empêche de le faire deux fois.
    expect(migration).toMatch(
      /\(kind = 'refund'\) = \(stripe_refund_id is not null\)/,
    );
  });
});

describe("l’enregistrement d’un remboursement", () => {
  it("ajoute une ligne, sans toucher à l’encaissement", async () => {
    const result = await recordRefund(REFUND);

    expect(result).toEqual({ ok: true, outcome: "recorded" });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      kind: "refund",
      stripe_refund_id: "re_test_1",
      gross_cents: 3500,
      donation_cents: 0,
      counterpart_cents: 0,
    });
  });

  it("porte un montant positif, pas un négatif", async () => {
    // Un montant négatif en base s'additionnerait silencieusement partout où
    // on aurait oublié de le traiter. Là, l'oubli se voit.
    await recordRefund(REFUND);

    expect(state.inserted[0]!.gross_cents).toBe(3500);
  });

  it("laisse la ligne d’encaissement identifiée par le paiement", async () => {
    await recordRefund(REFUND);

    expect(state.inserted[0]).toMatchObject({
      stripe_payment_intent_id: null,
      stripe_charge_id: "ch_test_1",
    });
  });

  it("dit que les frais sont de zéro, pas qu’ils sont inconnus", async () => {
    // Stripe garde sa commission sur un remboursement. Zéro est ici un fait,
    // pas une inconnue — toute la distinction que porte `null`.
    await recordRefund(REFUND);

    expect(state.inserted[0]).toMatchObject({ fee_cents: 0 });
  });

  it("retire l’accès au jeu", async () => {
    await recordRefund(REFUND);

    expect(state.statusUpdates[0]).toEqual({ status: "refunded" });
  });

  it("ne rejoue pas la ligne", async () => {
    state.insertError = { code: "23505" };

    expect(await recordRefund(REFUND)).toEqual({
      ok: true,
      outcome: "already-recorded",
    });
  });

  it("retire quand même l’accès après une première tentative morte en chemin", async () => {
    // Même raison qu'à la story 2.4 : si le rejeu s'arrêtait au doublon,
    // quelqu'un de remboursé continuerait de jouer.
    state.insertError = { code: "23505" };

    await recordRefund(REFUND);

    expect(state.statusUpdates).toHaveLength(1);
  });

  it("laisse jouer après un remboursement partiel", async () => {
    // Le seul cas où de l'argent repart et où la personne reste inscrite.
    await recordRefund({ ...REFUND, amountCents: 1000 });

    expect(state.statusUpdates).toHaveLength(0);
  });

  it("demande à réessayer quand l’écriture échoue", async () => {
    state.insertError = { code: "40001" };

    expect((await recordRefund(REFUND)).ok).toBe(false);
  });

  it("demande à réessayer quand le statut ne change pas", async () => {
    state.statusError = { code: "57014" };

    expect((await recordRefund(REFUND)).ok).toBe(false);
  });

  it("ne s’invente pas d’encaissement", async () => {
    // Un remboursement d'un paiement pris hors de l'application. Rien à quoi
    // le rattacher, et réessayer n'y changera rien.
    state.payment = null;

    expect(await recordRefund(REFUND)).toEqual({
      ok: true,
      outcome: "no-match",
    });
    expect(state.inserted).toHaveLength(0);
  });
});

describe("l’action de remboursement", () => {
  const action = code("src/lib/accounting/refund-actions.ts");

  it("exige un motif d’au moins une phrase", () => {
    // « ok » n'est pas un motif. Il sera lu dans six mois par quelqu'un qui
    // n'était pas là.
    expect(action).toMatch(/MINIMUM_REASON = 10/);
    expect(action).toMatch(/reason\.length < MINIMUM_REASON/);
  });

  it("écrit la trace avant que l’argent bouge, et renonce si elle échoue", () => {
    // `logAdminAction` ne lève pas : la story 1.10 laisse l'appelant décider.
    // Ici, pas de trace, pas de remboursement.
    const traceAt = action.indexOf("payment.refund_requested");
    const refundAt = action.indexOf("stripe.refunds.create");

    expect(traceAt).toBeGreaterThan(-1);
    expect(refundAt).toBeGreaterThan(traceAt);
    expect(action).toMatch(/if \(!traced\)[\s\S]{0,200}return/);
  });

  it("journalise aussi l’échec", () => {
    expect(action).toContain("payment.refund_failed");
    expect(action).toContain("payment.refunded");
  });

  it("vérifie le rôle avant tout", () => {
    const guardAt = action.indexOf("requireAdmin()");
    const refundAt = action.indexOf("stripe.refunds.create");

    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(refundAt);
  });

  it("donne à Stripe une clé d’idempotence", () => {
    // Deux clics à une seconde d'intervalle produisent un remboursement,
    // pas deux.
    expect(action).toMatch(/idempotencyKey: `refund-\$\{payment\.id\}`/);
  });

  it("refuse un encaissement déjà remboursé", () => {
    expect(action).toMatch(/déjà été remboursé/);
  });

  it("dit la vérité quand Stripe a remboursé mais que la base n’a pas suivi", () => {
    // Un message de succès qui cache une comptabilité désynchronisée serait
    // pire que le défaut lui-même.
    expect(action).toMatch(/if \(!recorded\.ok\)/);
    expect(action).toMatch(/bien été effectué chez Stripe/);
  });
});

describe("le webhook des remboursements", () => {
  const route = code("src/app/api/webhooks/stripe/route.ts");

  it("écoute les remboursements faits depuis Stripe", () => {
    // Ce que quelqu'un de pressé fera : rembourser depuis le tableau de bord.
    expect(route).toContain("charge.refunded");
    expect(route).toMatch(/recordRefund\(/);
  });

  it("renvoie une erreur pour que Stripe réessaie", () => {
    expect(route).toMatch(/status:\s*500/);
  });
});
