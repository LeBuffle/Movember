import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACTIVITY_SHARING } from "@/lib/activities/consent";
import { familiesFor } from "@/lib/activities/journal";

/* =========================================================================
 * Journal des sorties (epic 15)
 *
 * **Le seul écran du projet qui montre des données de santé d'une personne à
 * une autre.** Tout le reste — pseudonyme, points, rang — est un résultat de
 * jeu. Ce fichier tient les quatre choses qui, si elles cèdent, publient ce
 * que quelqu'un avait choisi de garder pour lui :
 *
 *   - une sortie masquée sur Strava qui ressort ici ;
 *   - une sortie dont on ignore le statut, publiée par défaut ;
 *   - le titre d'une sortie, qui est un champ libre ;
 *   - un retrait qui ne prend pas effet sur le passé.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*--.*$/gm, "");
}

const migration = code(
  read("supabase/migrations/20260813030000_activity_visibility.sql"),
);
const strava = code(read("src/lib/activities/sources/strava.ts"));
const journal = code(read("src/lib/activities/journal.ts"));
const store = code(read("src/lib/activities/store.ts"));

/* -------------------------------------------------------------------------
 * Ce qui est privé chez le fournisseur
 * ---------------------------------------------------------------------- */

describe("une sortie masquée sur Strava reste masquée ici", () => {
  it("le drapeau est conservé à la frontière", () => {
    // La portée `activity:read_all` sert à valider les défis de quelqu'un qui
    // ne publie rien. Ce n'est pas une autorisation de publier à sa place.
    expect(strava).toMatch(/function stravaIsPrivate/);
    expect(strava).toMatch(/isPrivate: stravaIsPrivate\(source\)/);
  });

  it("« réservé à mes abonnés » compte comme privé", () => {
    // Quelqu'un qui limite une sortie aux gens qui le suivent n'a pas accepté
    // six cents inconnus.
    expect(strava).toMatch(/source\.visibility !== "everyone"/);
  });

  it("et un format qu'on ne reconnaît pas aussi", () => {
    // Une charge utile plus ancienne, un champ que Strava renomme. Ne rien
    // savoir n'est pas savoir que c'est public.
    const start = strava.indexOf("function stravaIsPrivate");
    const fn = strava
      .slice(start, strava.indexOf("const positive", start))
      .trimEnd();

    // La dernière instruction de la fonction, quoi qu'il arrive avant.
    expect(fn.endsWith("return true;\n}")).toBe(true);
  });

  it("la base est prudente par défaut", () => {
    // Les sorties importées avant cette migration ne portent pas
    // l'information. Les publier rétroactivement reviendrait à décider à la
    // place de leur auteur.
    expect(migration).toMatch(
      /add column if not exists is_private boolean not null default true/,
    );
  });

  it("un réimport corrige la visibilité d'une sortie déjà en base", () => {
    // **Le trou que la recette a trouvé.** Une sortie déjà présente revient
    // en doublon et le reste de la ligne est laissé tel quel — ce qui est
    // voulu. Mais `is_private` est arrivé après les sorties qu'il décrit :
    // les lignes antérieures valaient « privée » faute de savoir, et aucun
    // réimport ne pouvait les corriger. Le journal restait vide pour
    // toujours, sans que rien ne le dise.
    expect(store).toMatch(/await reconcileVisibility\(activity\)/);

    const start = store.indexOf("async function reconcileVisibility");
    const fn = store.slice(
      start,
      store.indexOf("export async function updateActivity", start),
    );

    // Ce champ seulement : il ne décide rien dans le jeu. Mettre à jour la
    // distance ou le sport rejouerait l'évaluation d'un mois de sorties.
    expect(fn).toMatch(/\.update\(\{ is_private: activity\.isPrivate \}\)/);
    expect(fn).not.toMatch(/distance_meters|sport_family|duration_seconds/);
  });

  it("et une sortie repassée en publique le devient au passage suivant", () => {
    const update = store.slice(
      store.indexOf("export async function updateActivity"),
    );

    expect(update).toMatch(/is_private: activity\.isPrivate/);
  });
});

/* -------------------------------------------------------------------------
 * Ce que la lecture rend, et ce qu'elle ne demande pas
 * ---------------------------------------------------------------------- */

describe("le journal ne demande jamais le titre", () => {
  it("la requête ne porte que les cinq colonnes publiables", () => {
    // La différence entre une donnée absente d'une réponse et une donnée
    // présente mais non affichée : la seconde finit dans un outil de
    // développement, dans un cache, ou dans le prochain écran.
    const select = journal.slice(
      journal.indexOf(".select("),
      journal.indexOf('.eq("profile_id", profileId)'),
    );

    expect(select).toContain("sport_family");
    expect(select).toContain("distance_meters");
    expect(select).toContain("duration_seconds");
    expect(select).toContain("elevation_meters");
    expect(select).not.toContain("name");
  });

  it("et le composant n'a nulle part où l'afficher", () => {
    const entry = code(read("src/lib/activities/journal.ts"));

    expect(entry).toMatch(/export type JournalEntry = \{[^}]*\}/);
    expect(
      entry.slice(
        entry.indexOf("export type JournalEntry"),
        entry.indexOf("export type Journal ="),
      ),
    ).not.toContain("name");
  });
});

describe("les trois exclusions sont dans la requête, pas dans l'écran", () => {
  it("les sorties privées", () => {
    expect(journal).toMatch(/\.eq\("is_private", false\)/);
  });

  it("le retrait du participant, immédiatement et pour le passé", () => {
    // Aucune date n'entre dans la condition : couper l'affichage vide le
    // journal entier, pas seulement la suite.
    expect(journal).toMatch(
      /if \(owner\.activities_opt_out\) return \{ state: "hidden" \}/,
    );
  });

  it("les comptes suspendus et supprimés", () => {
    expect(journal).toMatch(/owner\.deleted_at \|\| owner\.suspended_at/);
  });

  it("et rien n'est lisible sans être un participant actif", () => {
    expect(journal).toMatch(/readerIsPlaying/);
    expect(journal).toMatch(/\.eq\("status", "active"\)/);
  });

  it("le journal ne remonte pas avant le début de l'édition", () => {
    expect(journal).toMatch(/\.gte\("started_at", start\.toISOString\(\)\)/);
  });

  it("dix, sans pagination", () => {
    // Comprendre un rythme, pas auditer un mois.
    expect(journal).toMatch(/JOURNAL_SIZE = 10/);
    expect(journal).not.toMatch(/\.range\(/);
  });
});

/* -------------------------------------------------------------------------
 * La catégorie consultée
 * ---------------------------------------------------------------------- */

describe("le journal suit la catégorie consultée", () => {
  it("les classements de distance filtrent leur famille", () => {
    expect(familiesFor("run")).toEqual(["run"]);
    expect(familiesFor("bike")).toEqual(["bike"]);
    expect(familiesFor("walk")).toEqual(["walk"]);
  });

  it("sorties et temps ne filtrent rien", () => {
    // Ce sont des classements tous sports confondus : les filtrer par famille
    // répondrait à une autre question que celle qui a été posée.
    expect(familiesFor("activities")).toBeNull();
    expect(familiesFor("duration")).toBeNull();
  });

  it("et les classements de défis n'ouvrent pas de journal", () => {
    // Ils récompensent des défis, et le défi de quelqu'un d'autre ne regarde
    // personne.
    expect(familiesFor("points")).toBe("none");
    expect(familiesFor("challenges")).toBe("none");
    expect(familiesFor("cards")).toBe("none");
  });
});

/* -------------------------------------------------------------------------
 * Le réglage
 * ---------------------------------------------------------------------- */

describe("le réglage du participant", () => {
  it("est activé par défaut", () => {
    // Décision J1 : un accord préalable aurait été plus prudent et aurait raté
    // sa cible — personne ne trouve un réglage facultatif.
    expect(migration).toMatch(
      /add column if not exists activities_opt_out boolean not null default false/,
    );
  });

  it("s'écrit par la session, jamais par un identifiant de formulaire", () => {
    const actions = code(read("src/lib/activities/visibility-actions.ts"));

    expect(actions).toMatch(/\.eq\("id", user\.id\)/);
    expect(actions).not.toMatch(/formData\.get\("profileId"\)/);
  });

  it("et il ne touche à rien d'autre", () => {
    // Un retrait qui coûterait un classement est un retrait que personne
    // n'ose, et un réglage que personne n'ose n'est pas un réglage.
    // Sur les écritures seulement : le chemin d'import du fichier contient
    // « activities », ce qui n'apprend rien.
    const actions = code(read("src/lib/activities/visibility-actions.ts"));
    const writes = [...actions.matchAll(/\.from\("([^"]+)"\)/g)].map(
      (match) => match[1],
    );

    expect(writes).toEqual(["profiles"]);
  });

  it("un classement qui ne sait pas ne propose pas d'ouvrir", () => {
    // Le repli de lecture des pseudonymes : sans la colonne, on ignore le
    // réglage — et proposer d'ouvrir les sorties de quelqu'un sans savoir
    // s'il est d'accord est précisément ce que cet epic évite.
    const reader = code(read("src/lib/leaderboards/read.ts"));

    expect(reader).toMatch(/showsActivities: false/);
  });
});

/* -------------------------------------------------------------------------
 * Ce qui est écrit là où on le lit
 * ---------------------------------------------------------------------- */

describe("les mentions disent ce qui se passe", () => {
  it("la règle est écrite à un seul endroit", () => {
    // Deux fichiers, deux moments de modification, et le premier qui dérive
    // est celui que personne ne relit.
    for (const page of [
      "src/app/(public)/confidentialite/page.tsx",
      "src/app/(participant)/mon-compte/activites/page.tsx",
    ]) {
      expect(read(page), page).toContain("ACTIVITY_SHARING");
    }
  });

  it("elle nomme le retrait et son innocuité", () => {
    expect(ACTIVITY_SHARING.rule).toMatch(/couper cet affichage/);
    expect(ACTIVITY_SHARING.rule).toMatch(/sans rien perdre de votre rang/);
  });

  it("et elle dit que le masquage Strava est respecté", () => {
    expect(ACTIVITY_SHARING.rule).toMatch(
      /masquées sur Strava restent masquées/,
    );
  });

  it("le titre figure dans ce qui n'est jamais montré", () => {
    expect(ACTIVITY_SHARING.hidden.join(" ")).toMatch(
      /nom que vous avez donné/,
    );
  });

  it("la politique ne prétend plus cacher le détail des activités", () => {
    // Elle disait « jamais le détail de vos activités ». C'était vrai avant
    // cet epic, et ça ne l'est plus : une phrase fausse dans une politique de
    // confidentialité est pire que pas de phrase du tout.
    const page = read("src/app/(public)/confidentialite/page.tsx");

    expect(page).not.toMatch(/jamais le détail de vos activités/);
  });
});
