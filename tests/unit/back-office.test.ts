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

/* =========================================================================
 * Suspendre un participant (story 8.7)
 *
 * Une fonction qu'on espère ne jamais utiliser. Cela ne la rend pas
 * facultative, et cela impose sa conception : difficile à déclencher par
 * accident, facile à annuler.
 * ====================================================================== */

const suspensionMigration = read(
  "supabase/migrations/20260806250000_participant_suspension.sql",
).replace(/--.*$/gm, "");
const suspension = code(read("src/lib/admin/suspension.ts"));
const suspensionForm = code(read("src/components/admin/suspension-form.tsx"));
const suspendedPage = code(read("src/app/(participant)/suspendu/page.tsx"));
const gameLayout = code(read("src/app/(participant)/jeu/layout.tsx"));
const access = code(read("src/lib/registration/access.ts"));

describe("suspendre n'est pas rembourser", () => {
  it("aucune écriture ne touche à l'inscription ni au paiement", () => {
    // Confondre les deux dans un seul geste, c'est prendre la seconde
    // décision sans l'avoir voulu.
    expect(suspension).not.toMatch(/from\("registrations"\)/);
    expect(suspension).not.toMatch(/from\("payments"\)/);
    expect(suspension).not.toMatch(/refund/i);
  });

  it("et l'écran le dit", () => {
    expect(suspensionForm).toMatch(/paiement restent intacts/);
    expect(suspensionForm).toMatch(/remboursement est une décision/);
  });
});

describe("le motif est obligatoire", () => {
  it("la base refuse une suspension sans motif", () => {
    // La garde est en base plutôt que dans le formulaire : un formulaire se
    // contourne, une contrainte non.
    expect(suspensionMigration).toMatch(
      /constraint profiles_suspension_needs_reason/,
    );
    expect(suspensionMigration).toMatch(
      /suspended_at is not null and suspension_reason is not null/,
    );
  });

  it("et le code le vérifie avant d'écrire", () => {
    expect(suspension).toMatch(/reason\.length < 3 \|\| reason\.length > 500/);
  });
});

describe("la suspension ne se pose que par l'organisation", () => {
  it("un déclencheur l'impose, la politique de ligne ne le pourrait pas", () => {
    // La sécurité au niveau des lignes filtre des LIGNES, pas des COLONNES :
    // sans ce déclencheur, un participant pourrait lever la sienne.
    expect(suspensionMigration).toMatch(
      /create trigger profiles_suspension_is_admin_only/,
    );
    expect(suspensionMigration).toMatch(/not public\.is_admin\(\)/);
  });

  it("et un administrateur ne peut pas se suspendre lui-même", () => {
    // L'écran qui lève une suspension est derrière la même porte.
    expect(suspension).toMatch(/id === admin\.id/);
  });
});

describe("elle est réversible, et les deux gestes sont tracés", () => {
  it("poser et lever écrivent chacun au journal", () => {
    expect(suspension).toMatch(/participant\.suspended/);
    expect(suspension).toMatch(/participant\.reinstated/);
  });

  it("la garde est portée par l'écriture", () => {
    // Deux bénévoles sur deux téléphones ne peuvent pas écraser le premier
    // motif par un second.
    expect(suspension).toMatch(/\.is\("suspended_at", null\)/);
    expect(suspension).toMatch(/\.not\("suspended_at", "is", null\)/);
  });

  it("et lever est plus simple que poser", () => {
    // Défaire ne doit jamais être plus difficile que faire : la pose demande
    // deux appuis et un motif, la levée un seul appui.
    expect(suspensionForm).toMatch(/setOpen\(true\)/);
    expect(suspensionForm).toMatch(/Lever la suspension/);
  });
});

describe("un suspendu disparaît des classements", () => {
  it("la vue les exclut à la source", () => {
    // Un filtre applicatif serait à répéter dans les classements individuels,
    // le classement d'équipe et les compteurs collectifs : le premier oublié
    // annulerait la mesure.
    expect(suspensionMigration).toMatch(/pr\.suspended_at is null/);
    expect(suspensionMigration).toMatch(
      /create materialized view public\.leaderboard_entries/,
    );
  });

  it("et la vue est repeuplée par la migration elle-même", () => {
    // Une vue matérialisée est vide tant qu'elle n'a pas été rafraîchie.
    expect(suspensionMigration).toMatch(
      /refresh materialized view public\.leaderboard_entries;/,
    );
  });

  it("son index unique survit à la recréation", () => {
    // Sans lui, le rafraîchissement `concurrently` devient impossible et le
    // classement se vide pour tout le monde quatre fois par heure.
    expect(suspensionMigration).toMatch(
      /create unique index leaderboard_entries_profile/,
    );
  });
});

describe("ce que voit le participant", () => {
  it("une explication, pas une page d'erreur", () => {
    expect(gameLayout).toMatch(/access\.suspension/);
    expect(suspendedPage).toMatch(/Votre accès a été suspendu/);
    expect(suspendedPage).not.toMatch(/notFound\(\)/);
  });

  it("le motif lui est donné", () => {
    // Quelqu'un qui ne sait pas pourquoi ne peut pas répondre — et la
    // première chose qu'il fera est de créer un second compte.
    expect(suspendedPage).toMatch(/access\.suspension\.reason/);
  });

  it("et on lui dit que son paiement n'est pas annulé", () => {
    expect(suspendedPage).toMatch(/paiement ne sont pas annulés/);
  });

  it("sans barre d'onglets, qui le renverrait ici", () => {
    expect(suspendedPage).toMatch(/tabs=\{false\}/);
  });

  it("une suspension n'est pas une inscription inachevée", () => {
    // L'y renvoyer lui dirait de payer de nouveau ce qu'il a déjà payé.
    expect(access).toMatch(
      /suspension: \{ since: string; reason: string \} \| null/,
    );
    expect(gameLayout).toMatch(/redirect\("\/suspendu"\)/);
  });
});
