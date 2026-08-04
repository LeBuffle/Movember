import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DRAFT_LEGAL_NOTICE,
  INDEPENDENCE_NOTICE,
  TAX_NOTICE,
  TAX_NOTICE_TITLE,
} from "@/lib/legal/notices";
import { formatEuros, getRegistrationTiers } from "@/lib/registration/tiers";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

/* =========================================================================
 * Mentions obligatoires
 *
 * Ce ne sont pas des préférences de rédaction. CLAUDE.md §6 impose que les
 * sommes versées soient annoncées comme des frais d'inscription et non comme
 * des dons, clairement et sans ambiguïté. Un participant qui découvrirait en
 * avril que son « don » n'est pas déductible aurait été trompé.
 * ====================================================================== */

describe("mention fiscale", () => {
  it("dit qu’il ne s’agit pas d’un don défiscalisable", () => {
    const complet = `${TAX_NOTICE_TITLE} ${TAX_NOTICE}`;

    expect(complet).toMatch(/défiscalisable/i);
    expect(complet).toMatch(/aucun reçu fiscal/i);
    expect(complet).toMatch(/CERFA/);
    expect(complet).toMatch(/réduction d’impôt/i);
  });

  it("qualifie l’inscription d’achat avec contrepartie", () => {
    expect(TAX_NOTICE).toMatch(/achat avec contrepartie/i);
  });

  it("n’emploie jamais le mot « don » pour ce que verse le participant", () => {
    // Le seul « don » du projet est celui que l'association fait ensuite à la
    // fondation. Écrire que le participant « fait un don » suffirait à créer
    // l'attente d'un reçu fiscal.
    expect(TAX_NOTICE).not.toMatch(/vous faites un don|votre don/i);
  });

  it("est affichée sur la page d’accueil, pas seulement en pied de page", () => {
    // AC 3. Un pied de page satisferait la lettre du critère et manquerait
    // son objet.
    const accueil = read("src/app/page.tsx");

    expect(accueil).toMatch(/<TaxNotice/);
    expect(read("src/components/layout/site-footer.tsx")).not.toMatch(
      /TaxNotice/,
    );
  });

  it("est reprise dans les conditions générales de vente", () => {
    expect(read("src/app/(public)/cgv/page.tsx")).toMatch(/TAX_NOTICE/);
  });
});

describe("mention d’indépendance", () => {
  it("dit que ce n’est pas l’application officielle de la fondation", () => {
    expect(INDEPENDENCE_NOTICE).toMatch(/n’est pas/i);
    expect(INDEPENDENCE_NOTICE).toMatch(/officielle/i);
    expect(INDEPENDENCE_NOTICE).toMatch(/association loi 1901/i);
    expect(INDEPENDENCE_NOTICE).toMatch(/aucun de ses logos/i);
  });

  it("est dans le pied de page, donc sur toutes les pages publiques", () => {
    expect(read("src/components/layout/site-footer.tsx")).toMatch(
      /INDEPENDENCE_NOTICE/,
    );
  });
});

describe("pages légales", () => {
  const pages = [
    ["cgv", "Conditions générales de vente"],
    ["confidentialite", "Politique de confidentialité"],
    ["mentions-legales", "Mentions légales"],
  ] as const;

  it.each(pages)(
    "/%s existe et est accessible depuis le pied de page",
    (slug) => {
      expect(
        existsSync(path.join(root, `src/app/(public)/${slug}/page.tsx`)),
      ).toBe(true);
      expect(read("src/components/layout/site-footer.tsx")).toContain(
        `href="/${slug}"`,
      );
    },
  );

  it.each(pages)("/%s signale que son contenu est provisoire", (slug) => {
    // Une page légale provisoire qui ne dit pas qu'elle l'est est pire qu'une
    // page absente : le visiteur la lit comme engageante.
    expect(read(`src/app/(public)/${slug}/page.tsx`)).toMatch(/<LegalPage/);
  });

  it("le bandeau « document de travail » est porté par la coquille commune", () => {
    // Posé une seule fois, il ne peut pas être oublié sur l'une des trois.
    const shell = read("src/components/marketing/legal-page.tsx");

    expect(shell).toMatch(/DRAFT_LEGAL_NOTICE/);
    expect(DRAFT_LEGAL_NOTICE).toMatch(/document de travail/i);
    expect(DRAFT_LEGAL_NOTICE).toMatch(/valeur contractuelle/i);
  });
});

/* =========================================================================
 * Niveaux d'inscription
 * ====================================================================== */

describe("niveaux d’inscription", () => {
  it("en propose trois, dont un seul mis en avant", () => {
    return getRegistrationTiers().then((tiers) => {
      expect(tiers).toHaveLength(3);
      expect(tiers.filter((tier) => tier.featured)).toHaveLength(1);
    });
  });

  it("ne reverse jamais plus que le prix payé", async () => {
    for (const tier of await getRegistrationTiers()) {
      expect(tier.donatedCents).toBeLessThanOrEqual(tier.priceCents);
      expect(tier.donatedCents).toBeGreaterThan(0);
    }
  });

  it("ne promet nulle part « 100 % »", async () => {
    // Décision P2, non tranchée : sur 12 € encaissés, le prestataire de
    // paiement prend environ 43 centimes. « 12 € reversés » est vrai quel que
    // soit celui qui absorbe les frais ; « 100 % » ne l'est pas.
    // Les commentaires de ces fichiers expliquent pourquoi il ne faut PAS
    // écrire « 100 % » et citent donc le terme. C'est ce qui est affiché qui
    // est inspecté ici, pas la prose qui l'entoure.
    const surfaces = [
      read("src/app/page.tsx"),
      read("src/components/marketing/tier-cards.tsx"),
      read("src/lib/registration/tiers.ts"),
    ]
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(surfaces).not.toMatch(/100\s*%/);
  });

  it("garde des montants en centimes, jamais en flottant", async () => {
    for (const tier of await getRegistrationTiers()) {
      expect(Number.isInteger(tier.priceCents)).toBe(true);
      expect(Number.isInteger(tier.donatedCents)).toBe(true);
    }
  });

  it("formate les montants à la française", () => {
    // Espace insécable avant l'euro : c'est ce que produit Intl, et le test
    // compare donc sur le motif plutôt que sur une chaîne exacte.
    expect(formatEuros(1200)).toMatch(/^12\s*€$/);
    expect(formatEuros(1257)).toMatch(/^12,57\s*€$/);
  });
});
