import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ASSOCIATION,
  HOSTING,
  PROJECT_CONTACT,
  registeredAddress,
} from "@/lib/legal/association";

import {
  DRAFT_LEGAL_NOTICE,
  INDEPENDENCE_NOTICE,
  TAX_NOTICE,
  TAX_NOTICE_TITLE,
} from "@/lib/legal/notices";
import { formatEuros } from "@/lib/registration/tiers";

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

describe("les crédits non dépensés — décision P8", () => {
  const cgv = read("src/app/(public)/cgv/page.tsx");
  const boutique = read(
    "src/app/(participant)/jeu/defis-joueurs/credits/page.tsx",
  );

  it("les conditions disent ce qu’il advient d’un crédit jamais utilisé", () => {
    // Un crédit acheté et non dépensé dont le sort n'est pas annoncé est une
    // réclamation qui arrive en décembre, et l'association n'aurait aucun
    // écrit sur quoi s'appuyer.
    expect(cgv).toMatch(/Crédits de défis entre joueurs/);
    expect(cgv).toMatch(
      /non dépensés au 30 novembre[\s\S]{0,120}pas remboursés/,
    );
    expect(cgv).toMatch(/reversé à la fondation Movember/);
  });

  it("et l’écran de vente le dit avant le paiement", () => {
    // Une règle qui n'existe que dans les conditions est une règle que
    // personne n'a lue. Elle doit être sur la page où l'on sort sa carte.
    expect(boutique).toMatch(/n’aurez pas utilisés au 30 novembre/);
  });

  it("un envoi refusé ne consomme aucun crédit, et c’est écrit", () => {
    // C'est la promesse la plus vérifiable du mécanisme, et celle qu'un
    // participant contestera en premier.
    expect(cgv).toMatch(/ne consomme aucun crédit/);
  });

  it("les conditions rappellent qu’un défi ne fait rien gagner", () => {
    // Décision P7. Sans elle, acheter des crédits pourrait se lire comme un
    // avantage au classement — ce que le projet interdit (PRD D2).
    expect(cgv).toMatch(/ni point, ni carte, ni place au classement/);
  });

  it("et qu’un crédit n’est ni cessible ni convertible en argent", () => {
    // Souple sur les retours à la ligne : Prettier reformate ce paragraphe.
    expect(cgv).toMatch(/ni\s+cessibles/);
    expect(cgv).toMatch(/ni\s+convertibles\s+en\s+argent/);
  });
});

describe("l’éditeur du site est identifiable", () => {
  const mentions = read("src/app/(public)/mentions-legales/page.tsx");
  const confidentialite = read("src/app/(public)/confidentialite/page.tsx");
  const cgv = read("src/app/(public)/cgv/page.tsx");

  it("les coordonnées vivent en un seul endroit", () => {
    // Une adresse retapée sur trois pages est une adresse qui sera corrigée
    // sur deux le jour où l'association déménage.
    expect(ASSOCIATION.name).toBe("RéACTION");
    expect(ASSOCIATION.rnaNumber).toMatch(/^W\d{9}$/);
    expect(registeredAddress()).toMatch(/32350 Barran/);

    for (const page of [mentions, confidentialite, cgv]) {
      expect(page).toMatch(/@\/lib\/legal\/association/);
    }
  });

  it("les mentions légales portent ce que la LCEN exige", () => {
    // Dénomination, siège, RNA, directeur de la publication, contact. Un site
    // qui encaisse de l'argent sans dire qui l'encaisse ne laisse personne à
    // qui se plaindre.
    expect(mentions).toMatch(/ASSOCIATION\.name/);
    expect(mentions).toMatch(/registeredAddress\(\)/);
    expect(mentions).toMatch(/ASSOCIATION\.rnaNumber/);
    expect(mentions).toMatch(/OFFICERS\.president/);
    expect(mentions).toMatch(/PUBLICATION_DIRECTOR/);
    expect(mentions).toMatch(/ASSOCIATION\.email/);
  });

  it("et la politique de confidentialité nomme le responsable de traitement", () => {
    // Le RGPD demande qu'il soit identifiable : « l'association organisatrice »
    // ne l'est pas.
    expect(confidentialite).toMatch(/responsable du traitement/);
    expect(confidentialite).toMatch(/ASSOCIATION\.name/);
    expect(confidentialite).toMatch(/ASSOCIATION\.email/);
  });

  it("les CGV disent avec qui le contrat est passé", () => {
    expect(cgv).toMatch(/ASSOCIATION\.name/);
    expect(cgv).toMatch(/ASSOCIATION\.rnaNumber/);
  });

  it("les deux adresses de contact ne sont pas la même", () => {
    // Une question sur un défi qui n'a pas validé et une demande d'exercice de
    // droits ne vont pas au même endroit ; une seule boîte, et l'une des deux
    // attend.
    expect(PROJECT_CONTACT.email).not.toBe(ASSOCIATION.email);
    expect(mentions).toMatch(/PROJECT_CONTACT\.email/);
  });

  it("l’hébergeur est nommé, comme la loi le demande", () => {
    expect(HOSTING.application.provider).toBe("Hostinger");
    expect(mentions).toMatch(/HOSTING\.application\.provider/);
  });

  it("et rien n’est inventé : ce qui manque est visible", () => {
    // Un détail légal plausible mais faux est pire qu'un blanc, parce que
    // personne ne s'aperçoit jamais qu'il est faux. Ce qui reste à fournir doit
    // donc se voir sur la page.
    expect(mentions).toMatch(/TO_BE_PROVIDED = "à compléter"/);
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
  // Ils vivent en base depuis la story 2.1 : un prix doit pouvoir changer
  // sans redéploiement. Ce sont donc la migration et le jeu de données qui
  // sont inspectés ici, pas une constante du code.
  // Commentaires SQL retirés : ils expliquent justement ce qu'il ne faut PAS
  // faire — « ne jamais écrire 100 % », « les frais réels » — et citeraient
  // donc les termes recherchés.
  const withoutSqlComments = (sql: string) => sql.replace(/--.*$/gm, "");

  const migrations = withoutSqlComments(
    readFileSync(
      path.join(
        root,
        "supabase/migrations/20260804100000_registrations_payments.sql",
      ),
      "utf8",
    ),
  );
  const seed = withoutSqlComments(read("supabase/seed.sql"));

  it("en propose trois", () => {
    // Les trois `slug` du jeu de démonstration.
    for (const slug of ["engage", "chevronne", "legendaire"]) {
      expect(seed).toContain(`'${slug}'`);
    }
  });

  it("ne peut pas reverser plus que le prix payé, garanti par la base", () => {
    // Une contrainte plutôt qu'une vérification dans le code : les montants
    // se modifient en SQL, sans passer par l'application.
    expect(migrations).toMatch(
      /check\s*\(\s*donated_cents\s*<=\s*price_cents\s*\)/i,
    );
  });

  it("garde des montants en centimes entiers", () => {
    // 12,10 € n'est pas représentable en binaire, et l'arrondi finirait dans
    // la comptabilité de l'association.
    // Chaque colonne en centimes, sans exception. Chercher « numeric » ou
    // « real » dans tout le fichier serait plus court et faux : « real »
    // apparaît aussi en anglais courant dans les libellés.
    const centsColumns = migrations.match(/^\s*\w*_cents\s+\w+/gm) ?? [];

    expect(centsColumns.length).toBeGreaterThanOrEqual(6);
    for (const declaration of centsColumns) {
      expect(declaration).toMatch(/\binteger\b/i);
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
      seed,
    ]
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(surfaces).not.toMatch(/100\s*%/);
  });

  it("n’a pas de liste de repli codée en dur", () => {
    // Une liste de secours « au cas où la base serait indisponible »
    // afficherait un prix pendant que le paiement en prélèverait un autre.
    // C'est la pire panne possible pour cette page.
    const source = read("src/lib/registration/tiers.ts");

    expect(source).not.toMatch(/priceCents:\s*\d/);
    expect(source).toMatch(/return \[\]/);
  });

  it("formate les montants à la française", () => {
    // Espace insécable avant l'euro : c'est ce que produit Intl, et le test
    // compare donc sur le motif plutôt que sur une chaîne exacte.
    expect(formatEuros(1200)).toMatch(/^12\s*€$/);
    expect(formatEuros(1257)).toMatch(/^12,57\s*€$/);
  });
});
