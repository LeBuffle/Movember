import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  accountingFilename,
  toAccountingCsv,
  type AccountingLine,
} from "@/lib/accounting/export";

/* =========================================================================
 * Comptabilité (stories 9.2, 9.3, 9.5)
 *
 * Sans cet epic l'association ne peut pas faire son don. Le critère de
 * sortie n'est pas « un fichier existe » mais « il se rapproche ligne à
 * ligne du relevé Stripe » — et c'est l'identifiant Stripe qui le permet.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const breakdown = code(read("src/lib/accounting/breakdown.ts"));
const reconcile = code(read("src/lib/accounting/reconcile.ts"));
const exportRoute = code(
  read("src/app/(admin)/admin/collecte/export/route.ts"),
);
const screen = code(read("src/app/(admin)/admin/collecte/page.tsx"));

function line(overrides: Partial<AccountingLine> = {}): AccountingLine {
  return {
    date: "2026-10-16T09:12:00.000Z",
    kind: "Encaissement",
    displayName: "Moustachu",
    tierName: "Sportif chevronné",
    grossCents: 3000,
    feeCents: 74,
    donationCents: 1800,
    stripeId: "ch_123",
    id: "row-1",
    ...overrides,
  };
}

describe("l'export comptable", () => {
  it("porte l'identifiant Stripe de chaque ligne", () => {
    // C'est lui qui rend le rapprochement possible. Sans lui, le trésorier
    // compare des montants et des dates — ce qui marche jusqu'à deux
    // paiements identiques le même jour.
    expect(toAccountingCsv([line()])).toContain("ch_123");
  });

  it("écrit les montants avec une virgule", () => {
    // Le fichier s'ouvre dans un tableur français ; « 30.00 » y est lu de
    // travers par certaines configurations.
    const csv = toAccountingCsv([line()]);

    expect(csv).toContain('"30,00"');
    expect(csv).toContain('"0,74"');
  });

  it("distingue encaissements et remboursements par une colonne", () => {
    const csv = toAccountingCsv([
      line(),
      line({ kind: "Remboursement", stripeId: "re_9" }),
    ]);

    expect(csv).toContain("Encaissement");
    expect(csv).toContain("Remboursement");
  });

  it("laisse les frais vides plutôt que d'écrire zéro", () => {
    // Un zéro affiché comme un total est un chiffre faux et cru ; un vide
    // se voit et se poursuit.
    expect(toAccountingCsv([line({ feeCents: null })])).toContain(',""');
  });

  it("survit à Excel et à ses accents", () => {
    // Marque d'ordre des octets et CRLF : sans elles, Excel sur Windows lit
    // l'UTF-8 comme du Latin-1 et casse tous les accents.
    const csv = toAccountingCsv([line()]);

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("produit ses en-têtes même sans une seule ligne", () => {
    // Un export vide en septembre est la réponse attendue, pas une erreur.
    const csv = toAccountingCsv([]);

    expect(csv).toContain("Identifiant Stripe");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
  });

  it("neutralise une valeur qu'un tableur prendrait pour une formule", () => {
    // Un fichier qui exécute du code à l'ouverture est une vraie façon de
    // livrer une machine.
    expect(toAccountingCsv([line({ displayName: "=1+1" })])).toContain("'=1+1");
  });

  it("nomme son fichier de façon triable et datée", () => {
    expect(accountingFilename(2026, "2026-11-30")).toBe(
      "comptabilite-2026-2026-11-30.csv",
    );
  });
});

describe("la route d'export", () => {
  it("revérifie le rôle : aucune mise en page ne la protège", () => {
    // Un gestionnaire de route n'a pas de layout au-dessus de lui. Oublier
    // cette ligne publierait ce que chacun a payé à qui devine l'adresse.
    expect(exportRoute).toMatch(/requireAdmin\(\)/);
    expect(exportRoute).toMatch(/status: 404/);
  });

  it("n'est mise en cache nulle part", () => {
    expect(exportRoute).toMatch(/no-store/);
    expect(exportRoute).toMatch(/private/);
  });

  it("arrive comme une pièce jointe", () => {
    expect(exportRoute).toMatch(/attachment; filename=/);
  });
});

describe("la ventilation par niveau", () => {
  it("distingue le montant encaissé du montant engagé", () => {
    // Sans les deux, « reversé » sera lu comme « collecté ».
    expect(breakdown).toMatch(/donationCents/);
    expect(breakdown).toMatch(/grossCents/);
    expect(screen).toMatch(/engagés auprès de la\s*\n?\s*fondation/);
  });

  it("soustrait les remboursements plutôt que de les additionner", () => {
    // Une ligne de remboursement porte un montant POSITIF (story 2.6). S'être
    // trompé une fois a fait annoncer publiquement de l'argent que
    // l'association n'avait plus.
    expect(breakdown).toMatch(/const isRefund = row\.kind === "refund"/);
    expect(breakdown).toMatch(/totals\.refundedCents \+= row\.gross_cents/);
  });

  it("vérifie que les lignes bouclent avec le total", () => {
    // Deux chiffres qui devraient être égaux et qui ne le sont pas, sur un
    // écran comptable, ruinent la confiance dans tout l'écran.
    expect(breakdown).toMatch(/reconciles: summedGross === totals\.grossCents/);
    expect(screen).toMatch(/breakdown\.reconciles/);
  });

  it("et le dit quand elles ne bouclent pas", () => {
    expect(screen).toMatch(/La ventilation ne boucle pas/);
  });
});

describe("la réconciliation Stripe", () => {
  it("passe par la même porte que le webhook", () => {
    // Elle hérite ainsi de ses garanties : une seconde activation est
    // refusée, une seconde ligne comptable aussi.
    expect(reconcile).toMatch(/handleCheckoutCompleted/);
    expect(reconcile).not.toMatch(/\.insert\(/);
  });

  it("n'examine que les sessions payées", () => {
    // Un panier abandonné n'est pas un écart, et le traiter comme tel
    // signalerait un problème à chaque visiteur qui a changé d'avis.
    expect(reconcile).toMatch(/payment_status === "paid"/);
  });

  it("regarde plus loin en arrière que les tentatives de Stripe", () => {
    // Stripe réessaie trois jours ; ce filet existe pour le jour où trois
    // jours ne suffisent pas.
    expect(reconcile).toMatch(/WINDOW_DAYS = 7/);
  });

  it("ne rejoue jamais ce qui est déjà connu", () => {
    expect(reconcile).toMatch(/if \(known\.has\(session\.id\)\) continue/);
  });

  it("ne signale jamais un écart en silence", () => {
    expect(reconcile).toMatch(/unrecoverable/);
    expect(reconcile).toMatch(/écart non rattrapable/);
  });

  it("et sur une table illisible, ne fait rien plutôt que tout rejouer", () => {
    // Renvoyer « rien n'est connu » ferait re-présenter cent sessions.
    expect(reconcile).toMatch(/return new Set\(ids\)/);
  });
});
