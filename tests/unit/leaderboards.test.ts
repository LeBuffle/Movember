import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Les classements (story 7.3)
 *
 * La clé de voûte de l'epic : les huit classements, le tableau de bord et les
 * compteurs collectifs sortent tous de cette vue.
 *
 * ⚠️ **Deux règles portent l'intégrité du jeu, et ce fichier existe surtout
 * pour elles.** Le classement général ne lit jamais les cartes ; le classement
 * collection ne compte que celles gagnées en jouant. C'est le seul endroit du
 * projet où l'argent pourrait toucher au jeu.
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
    .replace(/--.*$/gm, "");
}

/**
 * La fonction de rafraîchissement, posée une fois et jamais redéfinie.
 */
const migration = code(
  read("supabase/migrations/20260806210000_leaderboards.sql"),
);

/**
 * **La définition de la vue qui fait foi.**
 *
 * Elle a été recréée deux fois depuis la story 7.3 — par la suspension de
 * participant, puis par le classement Marche — et une vue matérialisée
 * n'accepte pas de colonne ajoutée : c'est toujours la dernière qui gagne.
 * Tester la première reviendrait à garantir les propriétés d'un fichier qui
 * ne s'exécute plus en dernier, ce qui est pire que ne rien tester.
 */
const view = code(
  read("supabase/migrations/20260813020000_walk_leaderboard.sql"),
);
const refresh = code(read("src/lib/leaderboards/refresh.ts"));
const cron = code(read("src/app/api/cron/classements/route.ts"));

/** La partie de la vue qui calcule les points du classement général. */
function section(name: string): string {
  const start = view.indexOf(`${name} as (`);
  expect(start, `bloc ${name} introuvable`).toBeGreaterThan(-1);

  // Cut at the CTE boundary — a closing parenthesis at the start of a line —
  // rather than at the first "),": that one sits inside `coalesce(sum(x), 0)`.
  const end = view.indexOf("\n)", start);

  return view.slice(start, end === -1 ? undefined : end);
}

describe("le classement général est purement sportif", () => {
  it("ses points ne lisent que les défis", () => {
    // Architecture D8, PRD D2, critère de sortie de l'epic 7.
    const totals = section("challenge_totals");

    expect(totals).toMatch(/from public\.challenge_assignments/);
    expect(totals).not.toMatch(/card_grants/);
    expect(totals).not.toMatch(/cards/);
  });

  it("et le rang général se calcule sur ces points, rien d'autre", () => {
    expect(migration).toMatch(
      /rank\(\) over \(partition by edition_id order by points desc\) as rank_points/,
    );
  });
});

describe("le classement des cartes ignore les cartes achetées", () => {
  it("il ne compte que challenge et daily_draw", () => {
    // Un pack acheté ne doit déplacer personne d'une seule place.
    const totals = section("card_totals");

    expect(totals).toMatch(/where g\.source in \('challenge', 'daily_draw'\)/);
  });

  it("et jamais pack, purchase ni manual", () => {
    const totals = section("card_totals");

    expect(totals).not.toMatch(/'pack'/);
    expect(totals).not.toMatch(/'purchase'/);
    expect(totals).not.toMatch(/'manual'/);
  });

  it("il compte des cartes distinctes, pas des exemplaires", () => {
    // Trois exemplaires de la même carte, c'est une carte dans une
    // collection : compter les attributions classerait par chance.
    const totals = section("card_totals");

    expect(totals).toMatch(/count\(distinct g\.card_id\)/);
  });
});

describe("les neuf classements", () => {
  it("sortent tous d'une seule vue", () => {
    // Architecture D14 : une passe sur les mêmes données, donc un neuvième
    // classement est quasiment gratuit.
    expect(view).toMatch(
      /create materialized view public\.leaderboard_entries/,
    );
  });

  it("portent chacun leur rang", () => {
    for (const column of [
      "rank_points",
      "rank_challenges",
      "rank_cards",
      "rank_run",
      "rank_bike",
      "rank_walk",
      "rank_activities",
      "rank_duration",
    ]) {
      expect(view).toMatch(new RegExp(`as ${column}`));
    }
  });

  it("et l'écran en annonce autant", () => {
    // Une colonne en base qu'aucun onglet n'affiche est un classement que
    // personne ne voit ; un onglet sans colonne est un écran qui casse.
    const categories = code(read("src/lib/leaderboards/categories.ts"));

    for (const column of ["rank_walk", "walk_distance_meters"]) {
      expect(categories, column).toContain(column);
    }
  });

  it("partagent une place en cas d'égalité", () => {
    // `row_number` départagerait arbitrairement, et le classement paraîtrait
    // instable à chaque recalcul.
    expect(view).toMatch(/rank\(\) over/);
    expect(view).not.toMatch(/row_number\(\) over/);
  });

  it("ne comptent que les inscriptions actives", () => {
    // Quelqu'un qui a abandonné en cours de paiement ou été remboursé n'est
    // pas dans le jeu.
    const participants = section("participants");

    expect(participants).toMatch(/where r\.status = 'active'/);
  });

  it("portent la date de leur calcul", () => {
    // AC 6 : pour que personne ne prenne un décalage pour une erreur.
    expect(view).toMatch(/now\(\) as computed_at/);
  });
});

describe("les classements sportifs se lisent depuis les sorties", () => {
  it("ils ne passent par aucun défi", () => {
    // **C'est la seconde façon de jouer.** Quelqu'un qui vise le kilométrage
    // sans se soucier du défi du jour doit exister au classement — sinon les
    // seuls classés sont ceux qui jouent au jeu tel qu'il a été pensé.
    const totals = section("activity_totals");

    expect(totals).toMatch(/from public\.activities act/);
    expect(totals).not.toMatch(/challenge_assignments/);
    expect(totals).not.toMatch(/status = 'completed'/);
  });

  it("course, vélo et marche comptent chacun leur famille", () => {
    const totals = section("activity_totals");

    for (const family of ["'run'", "'bike'", "'walk'"]) {
      expect(totals, family).toContain(`act.sport_family = ${family}`);
    }
  });

  it("sorties et temps comptent tous sports confondus", () => {
    // Y compris la natation et le renforcement, qui n'ont pas de classement
    // de distance : sans cela, une séance de piscine ne compterait nulle part.
    const totals = section("activity_totals");

    expect(totals).toMatch(/count\(\*\)::bigint as activity_count/);
    expect(totals).toMatch(/sum\(act\.duration_seconds\)/);
  });

  it("la photographie quotidienne conserve aussi le rang de marche", () => {
    // Sans quoi le classement existerait sans progression « depuis hier »,
    // ce qui se remarque dès le lendemain.
    expect(view).toMatch(/add column if not exists rank_walk/);
    expect(view).toMatch(/e\.rank_walk/);
  });

  it("et un rang absent d'une vieille photographie n'invente pas de progression", () => {
    // `Number(null)` vaut zéro : sans filtre, tout le monde afficherait une
    // remontée spectaculaire le jour de l'ajout d'un classement.
    const reader = code(read("src/lib/leaderboards/read.ts"));

    expect(reader.replace(/\s+/g, " ")).toMatch(
      /row\[rankColumn\] !== null && row\[rankColumn\] !== undefined/,
    );
  });
});

describe("le rafraîchissement", () => {
  it("ne rend jamais le classement indisponible", () => {
    // AC 5. Sans index unique, Postgres refuse le mode `concurrently` et
    // prend un verrou exclusif : un classement vide pour tout le monde,
    // plusieurs fois par heure.
    expect(migration).toMatch(/refresh materialized view concurrently/);
    expect(migration).toMatch(
      /create unique index leaderboard_entries_profile/,
    );
  });

  it("ne se chevauche jamais avec lui-même", () => {
    // AC 7. Deux tâches qui s'empilent, c'est ainsi qu'un petit retard devient
    // une panne.
    expect(migration).toMatch(/pg_try_advisory_xact_lock/);
    expect(migration).toMatch(/return false/);
  });

  it("n'est exécutable par personne depuis le navigateur", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.refresh_leaderboards\(\) from public, anon, authenticated/,
    );
  });

  it("et « déjà en cours » n'est pas une erreur", () => {
    // Une tâche qui signale un échec pour un cas normal est une tâche dont on
    // finit par ignorer les alertes.
    expect(refresh).toMatch(/refreshed: Boolean\(data\)/);
    expect(refresh).toMatch(/console\.info/);
  });

  it("passe par une tâche planifiée authentifiée", () => {
    // AC 2.
    expect(cron).toMatch(/isAuthorisedCronRequest/);
    expect(cron).toMatch(/refreshLeaderboards/);
  });
});

describe("rien ne calcule un classement à l'affichage", () => {
  it("le rafraîchissement est le seul chemin d'écriture", () => {
    expect(refresh).toMatch(/rpc\("refresh_leaderboards"\)/);
    expect(refresh).not.toMatch(/from\("challenge_assignments"\)/);
    expect(refresh).not.toMatch(/from\("activities"\)/);
  });
});

describe("la normalisation d'équipe se règle sans redéploiement", () => {
  it("elle vit dans une table, pas dans la vue", () => {
    // AC 4 de la story 7.5. Une formule perçue comme injuste vaut pire qu'une
    // absence de classement d'équipe, et elle sera discutée en novembre.
    expect(migration).toMatch(/create table public\.leaderboard_settings/);
    expect(migration).toMatch(/team_exponent numeric not null default 0\.5/);
  });

  it("elle est lisible par tous, parce que la règle est affichée", () => {
    expect(migration).toMatch(
      /create policy "everyone reads the ranking settings"/,
    );
  });

  it("et modifiable par les seuls administrateurs", () => {
    expect(migration).toMatch(
      /create policy "only admins change the ranking settings"[\s\S]*?is_admin/,
    );
  });

  it("la table active la sécurité au niveau des lignes", () => {
    expect(migration).toMatch(
      /alter table public\.leaderboard_settings enable row level security/,
    );
  });
});
