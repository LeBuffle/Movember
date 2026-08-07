import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Le back-office d'animation (stories 8.1 à 8.4, 8.8)
 *
 * Le critère de sortie de l'epic n'est pas technique : un bénévole non
 * technique doit pouvoir animer le mois depuis son téléphone, sans aide.
 * Ce que du code peut garantir, c'est ce qui suit — le reste se vérifie
 * avec le PO, sur son téléphone.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const journal = code(read("src/lib/admin/journal.ts"));
const journalPage = code(read("src/app/(admin)/admin/journal/page.tsx"));
const participants = code(read("src/lib/admin/participants.ts"));
const listPage = code(read("src/app/(admin)/admin/participants/page.tsx"));
const detailPage = code(
  read("src/app/(admin)/admin/participants/[id]/page.tsx"),
);
const overview = code(read("src/lib/admin/overview.ts"));
const home = code(read("src/app/(admin)/admin/page.tsx"));
const sections = code(read("src/lib/admin/sections.ts"));

describe("le journal est lisible, et rien d'autre", () => {
  it("il se lit enfin depuis l'application", () => {
    // La table existe depuis la story 1.10 ; jusqu'ici il fallait ouvrir le
    // SQL Editor de Supabase pour en voir une ligne.
    expect(journal).toMatch(/from\("admin_audit_log"\)/);
    expect(journalPage).toMatch(/getJournal/);
  });

  it("rien ne s'y écrit, ne s'y modifie ni ne s'y supprime", () => {
    for (const source of [journal, journalPage]) {
      expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    }
  });

  it("il passe par la session, pas par la clé de service", () => {
    // La politique de la table dit déjà « les administrateurs lisent le
    // journal ». Utiliser la clé de service ferait décider l'écran.
    expect(journal).not.toMatch(/createAdminClient/);
    expect(journal).toMatch(/supabase\/server/);
  });

  it("il nomme ses auteurs par pseudonyme, jamais par adresse", () => {
    expect(journal).toMatch(/from\("public_profiles"\)/);
    expect(journal).not.toMatch(/email/i);
  });

  it("et il se filtre et se pagine", () => {
    expect(journal).toMatch(/\.range\(/);
    expect(journal).toMatch(
      /if \(action\) query = query\.eq\("action", action\)/,
    );
  });
});

describe("l'écran des participants", () => {
  it("cherche par pseudonyme et par adresse à la fois", () => {
    // Quelqu'un qui répond à un message a l'un ou l'autre, jamais un choix
    // éclairé entre les deux.
    expect(participants).toMatch(/display_name\.ilike/);
    expect(participants).toMatch(/email\.ilike/);
  });

  it("échappe ce qui est tapé dans la recherche", () => {
    // Une virgule ou une parenthèse serait lue comme de la syntaxe PostgREST
    // et transformerait une recherche en un autre filtre.
    expect(participants).toMatch(/replace\(\/\[,\(\)\*\]\/g/);
  });

  it("est paginé : six cents participants ne tiennent pas sur un écran", () => {
    expect(participants).toMatch(/PAGE_SIZE/);
    expect(participants).toMatch(/\.range\(/);
  });

  it("ignore les comptes supprimés", () => {
    expect(participants).toMatch(/\.is\("deleted_at", null\)/);
  });

  it("cherche sans JavaScript", () => {
    // Un formulaire GET : le terme reste dans l'adresse, le résultat
    // s'envoie, et le bouton « précédent » se comporte normalement.
    expect(listPage).toMatch(/method="get"/);
  });

  it("distingue une liaison déconnectée d'une liaison rompue", () => {
    // Le participant a choisi la première ; afficher « rompue » enverrait le
    // support chercher un problème que personne n'a.
    expect(participants).toMatch(/if \(row\.disconnected_at\) continue/);
  });
});

describe("la fiche d'un participant", () => {
  it("ne modifie rien", () => {
    // Les corrections passent par les écrans qui les tracent : arbitrage,
    // remboursement, suspension.
    expect(detailPage).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
    expect(detailPage).not.toMatch(/"use server"/);
  });

  it("montre l'inscription, la liaison, les défis, les cartes et l'équipe", () => {
    for (const source of [
      "registration",
      "connection",
      "challenges",
      "cards",
      "team",
    ]) {
      expect(detailPage).toContain(source);
    }
  });

  it("ne montre pas l'adresse postale complète", () => {
    // Elle appartient à l'écran des livraisons, qui existe pour la personne
    // qui emballe les colis.
    expect(participants).toMatch(/\.select\("city, country"\)/);
    expect(participants).not.toMatch(/street|postal_code|line1/);
  });

  it("répond 404 sur un identifiant inconnu", () => {
    expect(detailPage).toMatch(/notFound\(\)/);
  });
});

describe("l'accueil du back-office", () => {
  it("dit si le tirage du jour a eu lieu", () => {
    // C'est la première question d'un matin de novembre.
    expect(overview).toMatch(/Aucun défi attribué aujourd’hui/);
    expect(home).toMatch(/overview\.assigned/);
  });

  it("et chaque alerte mène à l'écran qui la résout", () => {
    // Une alerte qui ne mène nulle part est une inquiétude, pas une
    // information.
    expect(overview).toMatch(/href: "\/admin\/defis\/attribution"/);
    expect(overview).toMatch(/href: "\/admin\/cartes"/);
    expect(home).toMatch(/href=\{alert\.href\}/);
  });
});

describe("l'état du catalogue", () => {
  it("s'exprime en jours, pas en pourcentage", () => {
    // « Il reste 34 défis » ne dit rien ; « le catalogue tient onze jours »
    // dit quand s'y mettre.
    expect(overview).toMatch(/daysLeft/);
    expect(overview).toMatch(
      /Math\.floor\(catalogue\.available \/ participants\)/,
    );
    expect(home).toMatch(/jour\s*\n?\s*\{overview\.catalogue\.daysLeft > 1/);
  });

  it("ne projette rien quand personne ne joue", () => {
    // Diviser par zéro participant donnerait une durée infinie affichée
    // comme une certitude.
    expect(overview).toMatch(/participants > 0[\s\S]{0,80}: null/);
  });

  it("alerte avant la rupture, pas au moment où elle arrive", () => {
    expect(overview).toMatch(/daysLeft <= 7/);
  });
});

describe("les sections annoncées existent", () => {
  it("participants et journal ne sont plus « à venir »", () => {
    for (const slug of ["participants", "journal"]) {
      const region = sections.slice(sections.indexOf(`slug: "${slug}"`));

      expect(region.slice(0, 300)).toMatch(/status: "available"/);
    }
  });
});
