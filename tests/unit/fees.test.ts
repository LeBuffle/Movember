import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatRate,
  summarisePayments,
  type PaymentRow,
} from "@/lib/accounting/totals";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Les frais réels, jamais estimés
 *
 * « Environ 1,4 % + 0,25 € » est une bonne estimation et une mauvaise
 * comptabilité : le taux dépend de la carte, et l'écart se voit sur le relevé
 * — au moment précis où l'association doit justifier ce qu'elle a reversé.
 * ====================================================================== */

/* ---------------------------------------------------------------------------
 * Un faux client Supabase, pour éprouver l'écriture
 * ------------------------------------------------------------------------ */

type FakeState = {
  payment: { id: string; fee_cents: number | null; gross_cents: number } | null;
  readError: { code: string } | null;
  writeError: { code: string } | null;
  pending: Array<{ stripe_payment_intent_id: string | null }>;
  updates: Array<Record<string, unknown>>;
};

const state: FakeState = {
  payment: null,
  readError: null,
  writeError: null,
  pending: [],
  updates: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from() {
      const pendingQuery = {
        is: () => pendingQuery,
        not: () => pendingQuery,
        order: () => pendingQuery,
        limit: async () => ({ data: state.pending, error: null }),
        eq: () => ({
          maybeSingle: async () => ({
            data: state.payment,
            error: state.readError,
          }),
        }),
      };

      return {
        select: () => pendingQuery,
        update: (patch: Record<string, unknown>) => {
          state.updates.push(patch);
          return { eq: async () => ({ error: state.writeError }) };
        },
      };
    },
  }),
}));

const { feesFrom, recordFeesFromCharge, sweepPendingFees } =
  await import("@/lib/accounting/fees");

type Charge = Parameters<typeof recordFeesFromCharge>[0];

function charge(overrides: Record<string, unknown> = {}): Charge {
  return {
    id: "ch_test_1",
    object: "charge",
    amount: 3500,
    payment_intent: "pi_test_1",
    balance_transaction: "txn_test_1",
    ...overrides,
  } as unknown as Charge;
}

function stubStripe(
  transaction: Record<string, unknown> | Error | null = {
    id: "txn_test_1",
    fee: 60,
    net: 3440,
    amount: 3500,
    currency: "eur",
  },
) {
  const retrieve = vi.fn(async () => {
    if (transaction instanceof Error) throw transaction;
    if (transaction === null) throw new Error("introuvable");
    return transaction;
  });

  return {
    client: { balanceTransactions: { retrieve } } as any,
    retrieve,
  };
}

beforeEach(() => {
  state.payment = { id: "payment-uuid", fee_cents: null, gross_cents: 3500 };
  state.readError = null;
  state.writeError = null;
  state.pending = [];
  state.updates = [];

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

/* ---------------------------------------------------------------------------
 * La lecture des frais
 * ------------------------------------------------------------------------ */

describe("la lecture d’une transaction de solde", () => {
  it("prend les frais et le net tels que Stripe les donne", () => {
    expect(
      feesFrom({ fee: 60, net: 3440, amount: 3500, currency: "eur" }),
    ).toEqual({ fee_cents: 60, net_cents: 3440 });
  });

  it("refuse une transaction dans une autre devise", () => {
    // Une conversion a eu lieu : les chiffres ne sont plus comparables à ce
    // qui a été débité, et un total faux vaut moins qu'un total manquant.
    expect(
      feesFrom({ fee: 60, net: 3440, amount: 3500, currency: "usd" }),
    ).toBe(null);
  });

  it.each([
    ["des frais décimaux", { fee: 60.5, net: 3440, amount: 3500 }],
    ["des frais négatifs", { fee: -60, net: 3560, amount: 3500 }],
    ["un net décimal", { fee: 60, net: 3440.2, amount: 3500 }],
  ])("refuse %s", (_label, values) => {
    expect(feesFrom({ ...values, currency: "eur" })).toBe(null);
  });

  it("accepte des frais nuls", () => {
    // Rare mais réel — certains moyens de paiement, certaines promotions.
    // Zéro constaté n'est pas zéro par défaut.
    expect(
      feesFrom({ fee: 0, net: 3500, amount: 3500, currency: "eur" }),
    ).toEqual({ fee_cents: 0, net_cents: 3500 });
  });
});

/* ---------------------------------------------------------------------------
 * L'écriture
 * ------------------------------------------------------------------------ */

describe("l’enregistrement des frais", () => {
  it("complète la ligne, et seulement trois colonnes", async () => {
    // L'immuabilité de la story 2.1 porte sur ce qui est déjà écrit. Un
    // montant encaissé ne doit jamais être réécrit par ce chemin.
    const { client } = stubStripe();

    expect(await recordFeesFromCharge(charge(), client)).toEqual({
      ok: true,
      outcome: "recorded",
    });

    expect(state.updates).toHaveLength(1);
    expect(Object.keys(state.updates[0]!).sort()).toEqual([
      "fee_cents",
      "net_cents",
      "stripe_charge_id",
    ]);
    expect(state.updates[0]).toMatchObject({ fee_cents: 60, net_cents: 3440 });
  });

  it("garde l’identifiant de la transaction pour le rapprochement", async () => {
    const { client } = stubStripe();

    await recordFeesFromCharge(charge(), client);

    expect(state.updates[0]).toMatchObject({ stripe_charge_id: "ch_test_1" });
  });

  it("n’écrit rien quand les frais sont déjà les mêmes", async () => {
    // Un rejeu ne doit toucher à rien.
    state.payment = { id: "payment-uuid", fee_cents: 60, gross_cents: 3500 };
    const { client } = stubStripe();

    expect(await recordFeesFromCharge(charge(), client)).toEqual({
      ok: true,
      outcome: "unchanged",
    });
    expect(state.updates).toHaveLength(0);
  });

  it("attend plutôt que d’inventer quand la transaction n’existe pas encore", async () => {
    // Cas normal dans les secondes qui suivent un paiement. Ce n'est pas une
    // erreur : la tâche horaire y reviendra.
    const { client } = stubStripe();

    expect(
      await recordFeesFromCharge(charge({ balance_transaction: null }), client),
    ).toEqual({ ok: true, outcome: "not-ready" });
    expect(state.updates).toHaveLength(0);
  });

  it("attend aussi quand Stripe ne rend pas la transaction", async () => {
    const { client } = stubStripe(new Error("rate limited"));

    expect(await recordFeesFromCharge(charge(), client)).toEqual({
      ok: true,
      outcome: "not-ready",
    });
  });

  it("ne s’affole pas si la ligne comptable n’existe pas encore", async () => {
    // Stripe n'ordonne pas ses livraisons : l'événement de frais peut
    // précéder celui du paiement.
    state.payment = null;
    const { client } = stubStripe();

    expect(await recordFeesFromCharge(charge(), client)).toEqual({
      ok: true,
      outcome: "no-match",
    });
  });

  it("demande à réessayer quand l’écriture échoue", async () => {
    state.writeError = { code: "40001" };
    const { client } = stubStripe();

    expect((await recordFeesFromCharge(charge(), client)).ok).toBe(false);
  });

  it("demande à réessayer quand la ligne est illisible", async () => {
    state.readError = { code: "57014" };
    const { client } = stubStripe();

    expect((await recordFeesFromCharge(charge(), client)).ok).toBe(false);
  });

  it("ne fait rien sans paiement rattaché", async () => {
    const { client, retrieve } = stubStripe();

    expect(
      await recordFeesFromCharge(charge({ payment_intent: null }), client),
    ).toEqual({ ok: true, outcome: "no-match" });
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("le rattrapage planifié", () => {
  it("ne fait rien quand Stripe n’est pas configuré", async () => {
    expect(await sweepPendingFees(50, null)).toEqual({
      examined: 0,
      recorded: 0,
      stillPending: 0,
    });
  });

  it("rend compte de ce qu’il a examiné", async () => {
    // Ce que le journal doit dire : combien de lignes attendaient, combien
    // ont été complétées. Une tâche silencieuse est une tâche qu'on croit
    // fonctionner.
    state.pending = [];

    expect(await sweepPendingFees(50, stubStripe().client)).toMatchObject({
      examined: 0,
    });
  });
});

/* ---------------------------------------------------------------------------
 * Les totaux
 * ------------------------------------------------------------------------ */

describe("les totaux de la collecte", () => {
  const income = (
    gross: number,
    fee: number | null,
    donation: number,
  ): PaymentRow => ({
    kind: "registration",
    gross_cents: gross,
    fee_cents: fee,
    donation_cents: donation,
    counterpart_cents: gross - donation,
  });

  it("additionne encaissements, frais, don et contrepartie", () => {
    const totals = summarisePayments([
      income(3500, 60, 2000),
      income(1200, 43, 1200),
    ]);

    expect(totals.incomeCount).toBe(2);
    expect(totals.grossCents).toBe(4700);
    expect(totals.knownFeeCents).toBe(103);
    expect(totals.donationCents).toBe(3200);
    expect(totals.counterpartCents).toBe(1500);
    expect(totals.netCents).toBe(4597);
  });

  it("signale les lignes dont les frais manquent", () => {
    // Un total dont les frais sont incomplets est provisoire. Ne pas le dire
    // produirait un chiffre faux qu'on croirait juste — pire qu'un chiffre
    // manquant.
    const totals = summarisePayments([
      income(3500, 60, 2000),
      income(1200, null, 1200),
    ]);

    expect(totals.complete).toBe(false);
    expect(totals.pendingFeeCount).toBe(1);
    expect(totals.pendingFeeGrossCents).toBe(1200);
  });

  it("calcule le taux sur les seules lignes connues", () => {
    // Diviser des frais partiels par un brut complet sous-estimerait le taux
    // — exactement la direction qui nous arrange.
    const totals = summarisePayments([
      income(1000, 40, 500),
      income(1000, null, 500),
    ]);

    expect(totals.feeRate).toBe(4);
    expect(totals.averageFeeCents).toBe(40);
  });

  it("ne prétend aucun taux quand rien n’est connu", () => {
    const totals = summarisePayments([income(1000, null, 500)]);

    expect(totals.feeRate).toBe(null);
    expect(totals.averageFeeCents).toBe(null);
  });

  it("déduit les remboursements du net, sans les compter comme encaissements", () => {
    const totals = summarisePayments([
      income(3500, 60, 2000),
      {
        kind: "refund",
        gross_cents: 3500,
        fee_cents: null,
        donation_cents: 0,
        counterpart_cents: 0,
      },
    ]);

    expect(totals.incomeCount).toBe(1);
    expect(totals.refundCount).toBe(1);
    expect(totals.refundedCents).toBe(3500);
    expect(totals.netCents).toBe(-60);
    // Un remboursement n'attend pas de frais : il ne doit pas rendre le
    // total « provisoire ».
    expect(totals.complete).toBe(true);
  });

  it("tient debout sans aucun paiement", () => {
    const totals = summarisePayments([]);

    expect(totals.grossCents).toBe(0);
    expect(totals.complete).toBe(true);
    expect(totals.feeRate).toBe(null);
  });

  it("écrit un taux à la française", () => {
    expect(formatRate(1.7345)).toBe("1,73 %");
  });
});

/* ---------------------------------------------------------------------------
 * Le câblage
 * ------------------------------------------------------------------------ */

describe("le câblage du rapprochement", () => {
  it("écoute les événements qui portent les frais", () => {
    const route = code("src/app/api/webhooks/stripe/route.ts");

    expect(route).toContain("charge.succeeded");
    expect(route).toContain("charge.updated");
  });

  it("a une tâche planifiée, protégée par le secret", () => {
    // Le webhook ne suffit pas : une transaction pas encore prête, une
    // livraison perdue, un redémarrage au mauvais moment laisseraient une
    // ligne incomplète pour toujours.
    const route = code("src/app/api/cron/rapprochement/route.ts");

    expect(route).toMatch(/isAuthorisedCronRequest\(request\)/);
    expect(route).toMatch(/sweepPendingFees\(\)/);
  });

  it("installe la tâche par le dépôt, pas à la main sur le serveur", () => {
    // Une ligne ajoutée à la main disparaîtrait au déploiement suivant.
    expect(code("deploy/crontab")).toContain("/api/cron/rapprochement");
  });

  it("n’estime jamais les frais", () => {
    // Le mot-clé de la story : aucune constante de taux nulle part.
    const fees = code("src/lib/accounting/fees.ts");

    expect(fees).not.toMatch(/0\.014|1\.4\s*%|0\.25/);
    expect(fees).toMatch(/balanceTransactions\.retrieve/);
  });
});
