import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { podiumIsMeaningful } from "@/components/leaderboards/podium";
import type { LeaderboardRow } from "@/lib/leaderboards/read";
import { RETENTION_RULES } from "@/lib/privacy/retention";

/* =========================================================================
 * Classements vivants (epic 13)
 *
 * **Cet epic déplace des pixels.** Aucune règle de points, aucune source de
 * carte, aucun seuil ne bouge — et c'est ce qui le rend sans danger. Les tests
 * de l'epic 7 restent la référence et doivent passer sans être modifiés.
 *
 * Ce que ce fichier protège, c'est le reste : une progression qui invente un
 * chiffre, un podium qui couronne trois personnes à égalité, une recherche qui
 * ne cherche que la page affichée.
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

const migration = code(
  read("supabase/migrations/20260806290000_leaderboard_snapshots.sql"),
);
const reader = code(read("src/lib/leaderboards/read.ts"));
const snapshot = code(read("src/lib/leaderboards/snapshot.ts"));
const movement = code(read("src/components/leaderboards/rank-movement.tsx"));
const badge = code(read("src/components/leaderboards/rank-badge.tsx"));
const card = code(read("src/components/leaderboards/leaderboard-card.tsx"));
const screen = code(read("src/app/(participant)/jeu/classement/page.tsx"));
const crontab = read("deploy/crontab");

function row(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    profileId: "p1",
    displayName: "Moustachu",
    rank: 1,
    value: 100,
    isSelf: false,
    movement: null,
    isNew: false,
    challengeable: false,
    ...overrides,
  };
}

describe("la photographie quotidienne", () => {
  it("ne calcule rien : elle recopie la vue", () => {
    // C'est ce qui rend cette story incapable de fausser un classement.
    expect(migration).toMatch(/from public\.leaderboard_entries/);
    expect(migration).not.toMatch(/rank\(\) over|group by/);
  });

  it("est rejouable : un second passage n’écrit rien", () => {
    // La photographie du jour est celle du matin. Une relance à midi ne doit
    // pas la remplacer par l'état de midi — sinon « depuis hier matin »
    // devient faux sans prévenir.
    expect(migration).toMatch(/on conflict[\s\S]*do nothing/);
    expect(migration).toMatch(
      /primary key \(edition_id, profile_id, taken_on\)/,
    );
  });

  it("personne ne peut écrire une progression flatteuse", () => {
    // Le seul chiffre de cet epic qui puisse être truqué.
    const policies = migration.slice(migration.indexOf("enable row level"));

    expect(policies).not.toMatch(/for insert|for update|for all|for delete/);
  });

  it("et le jour se calcule à Paris, pas en UTC", () => {
    // À une heure du matin, la date UTC est déjà celle du lendemain : la
    // photographie du 5 novembre serait rangée au 6.
    expect(migration).toMatch(/at time zone 'Europe\/Paris'/);
  });

  it("zéro ligne écrite n’est pas une erreur", () => {
    expect(snapshot).toMatch(/déjà prise aujourd’hui/);
    expect(snapshot).toMatch(/console\.info/);
  });

  it("et elle est purgée avec le reste, pas conservée pour toujours", () => {
    // Un rang par jour et par participant reste une donnée personnelle. Elle
    // n'a plus d'usage une fois l'édition close : rien n'affiche « depuis
    // hier » en mars.
    const rule = RETENTION_RULES.find(
      (entry) => entry.table === "leaderboard_snapshots",
    );

    expect(rule).toBeDefined();
    expect(rule!.months).toBeLessThanOrEqual(6);
  });

  it("la tâche est installée par le dépôt, avant les défis du jour", () => {
    const photo = Number(
      crontab.match(/^(\d+) (\d+) .*cron\/photographie/m)![2],
    );
    const photoMinute = Number(
      crontab.match(/^(\d+) (\d+) .*cron\/photographie/m)![1],
    );
    const challengesMinute = Number(
      crontab.match(/^(\d+) (\d+) .*cron\/defis-du-jour/m)![1],
    );
    const challenges = Number(
      crontab.match(/^(\d+) (\d+) .*cron\/defis-du-jour/m)![2],
    );

    // Prise APRÈS les défis, elle contiendrait déjà le mouvement d'une journée
    // qui n'a pas été jouée.
    expect(photo * 60 + photoMinute).toBeLessThan(
      challenges * 60 + challengesMinute,
    );
  });
});

describe("la progression", () => {
  it("distingue trois cas, et ne les confond jamais", () => {
    // Sans repère → tiret. Absent hier → nouveau. Présent hier → un écart.
    // Confondre deux d'entre eux produit un chiffre faux.
    expect(reader).toMatch(
      /previous\.takenOn === null \|\| before === undefined \? null/,
    );
    expect(reader).toMatch(
      /isNew: previous\.takenOn !== null && before === undefined/,
    );
  });

  it("un rang qui baisse est une montée", () => {
    // Passer de 12ᵉ à 9ᵉ, c'est « +3 ». L'ordre de la soustraction est tout.
    expect(reader).toMatch(/before - rank/);
  });

  it("affiche un tiret plutôt qu’un zéro inventé", () => {
    // Un « +0 » posé faute de repère se lit « je n'ai pas bougé », ce qui est
    // une autre affirmation, et une fausse.
    expect(movement).toMatch(/movement === null/);
    expect(movement).toMatch(/Pas de repère/);
  });

  it("un nouveau venu n’a pas chuté de 340 places", () => {
    expect(movement).toMatch(/isNew/);
    expect(movement).toMatch(/nouveau/);
  });

  it("le sens ne repose pas sur la couleur seule", () => {
    // Une flèche, un signe, et un intitulé lu par un lecteur d'écran.
    expect(movement).toMatch(/aria-label=/);
    expect(movement).toMatch(/<Arrow up=/);
  });

  it("et l’écran dit depuis quand elle est mesurée", () => {
    // « +3 » sans période est une information que le lecteur complète de
    // travers une fois sur deux.
    expect(screen).toMatch(/function ComparedTo/);
    expect(screen).toMatch(/mesurés depuis le/);
    expect(reader).toMatch(/comparedTo: previous\.takenOn/);
  });

  it("une photographie illisible ne fabrique aucun écart", () => {
    expect(reader).toMatch(/photographie illisible/);
    expect(reader).toMatch(/return \{ ranks: new Map\(\), takenOn: null \}/);
  });
});

describe("le podium", () => {
  const board = (values: number[]) =>
    values.map((value, index) =>
      row({ profileId: `p${index}`, rank: index + 1, value }),
    );

  it("n’apparaît pas le premier matin, quand tout le monde est à zéro", () => {
    // Il couronnerait trois personnes pour leur place dans un départage.
    expect(podiumIsMeaningful(board([0, 0, 0, 0]))).toBe(false);
  });

  it("ni quand l’égalité déborde sur la quatrième place", () => {
    expect(podiumIsMeaningful(board([10, 8, 5, 5]))).toBe(false);
  });

  it("ni à moins de quatre participants", () => {
    expect(podiumIsMeaningful(board([10, 8, 5]))).toBe(false);
  });

  it("mais bien dès qu’il y a un écart réel", () => {
    expect(podiumIsMeaningful(board([10, 8, 5, 3]))).toBe(true);
  });

  it("et il se présente comme provisoire", () => {
    const podium = code(read("src/components/leaderboards/podium.tsx"));

    expect(podium).toMatch(/Podium provisoire/);
    expect(podium).toMatch(/aria-label="Podium provisoire"/);
  });
});

describe("les médailles", () => {
  it("portent leur rang en chiffres, pas seulement en couleur", () => {
    // Or, argent et bronze sont trois nuances proches pour huit pour cent des
    // hommes — et ce jeu s'adresse d'abord à des hommes.
    expect(badge).toMatch(/aria-label=\{`\$\{rank\}ᵉ/);
    expect(badge).toMatch(/\{rank\}<\/span>/);
  });

  it("ne concernent que les trois premiers", () => {
    expect(badge).toMatch(/const MEDALS: Record<number/);
    expect(badge).toMatch(/if \(!medal\)/);
  });
});

describe("la recherche", () => {
  it("cherche dans tout le classement, pas dans la page affichée", () => {
    // Un filtre répond « aucun résultat » pour quelqu'un classé 342ᵉ, qui
    // existe. C'est le défaut qu'on livre par accident.
    expect(reader).toMatch(/export async function searchLeaderboard/);
    expect(reader).toMatch(/from\("public_profiles"\)/);
  });

  it("rend le rang réel, pas la position dans les résultats", () => {
    // Numéroter les résultats 1, 2, 3 dirait au lecteur que la personne
    // cherchée est troisième alors qu'elle est 342ᵉ. Deux garde-fous : le rang
    // est fabriqué par le même buildRow que le classement, et l'écran réutilise
    // la même carte — aucun des deux ne connaît la position dans la liste.
    expect(reader).toMatch(
      /\.map\(\(row\) => buildRow\(row, definition, names, self, previous\)\)/,
    );
    expect(reader).toMatch(
      /\.sort\(\(left, right\) => left\.rank - right\.rank\)/,
    );
    expect(screen).toMatch(
      /results\.map\(\(row\) => \([\s\S]{0,200}<LeaderboardCard row=\{row\}/,
    );
    expect(screen).not.toMatch(/results\.map\(\(\w+, ?index\)/);
  });

  it("neutralise ce qu’un pseudonyme peut contenir", () => {
    // Une apostrophe, une parenthèse, une virgule : lues comme de la syntaxe
    // de filtre plutôt que comme du texte.
    expect(reader).toMatch(/replace\(\/\[,\(\)\*%\]\/g, " "\)/);
  });

  it("une recherche vide ne déverse pas le classement entier", () => {
    expect(reader).toMatch(/if \(term\.length < 2\) return \[\]/);
  });
});

describe("les cartes", () => {
  it("restent compactes : une ligne de haut, pas une vignette", () => {
    // Le piège du format en cartes est de tripler la hauteur de chaque ligne :
    // le 40ᵉ devient alors inatteignable sans dix balayages.
    expect(card).toMatch(/flex items-center gap-3 rounded-xl border p-3/);
    expect(card).not.toMatch(/aspect-|h-32|h-40/);
  });

  it("marquent la carte du lecteur", () => {
    expect(card).toMatch(/row\.isSelf/);
    expect(card).toMatch(/— vous/);
  });

  it("et sa position est épinglée quand il n’est pas dans la liste", () => {
    expect(screen).toMatch(/Votre position/);
    expect(screen).toMatch(/!board\.rows\.some\(\(row\) => row\.isSelf\)/);
  });

  it("un participant non classé reçoit une phrase, pas un vide", () => {
    expect(screen).toMatch(/Vous n’êtes pas encore classé ici/);
  });
});

describe("le pseudonyme est l’information essentielle", () => {
  it("une colonne annexe illisible ne l’efface pas", () => {
    // Arrivé pour de vrai le 11 août : `duels_opt_out` est apparu avec l'epic
    // 12, et entre le déploiement du code et l'application de sa migration, la
    // requête enrichie échouait — chaque pseudonyme du classement devenait
    // « Participant ». Un classement anonyme est un écran cassé ; un
    // classement sans bouton « Défier » est un écran sans commodité.
    const body = reader.slice(
      reader.indexOf("async function displayNames"),
      reader.indexOf("export async function getLeaderboard"),
    );

    // La requête enrichie, puis un repli qui ne demande que l'indispensable.
    expect(body).toMatch(/select\("id, display_name, duels_opt_out"\)/);
    expect(body).toMatch(/select\("id, display_name"\)/);
  });

  it("et l’échec est journalisé, jamais avalé", () => {
    // La lecture ne renvoyait rien, en silence, pendant tout un déploiement :
    // c'est ainsi que le défaut est arrivé au PO avant d'arriver dans un
    // journal.
    const body = reader.slice(
      reader.indexOf("async function displayNames"),
      reader.indexOf("export async function getLeaderboard"),
    );

    expect(body).toMatch(/console\.error/);
    expect(body).not.toMatch(/const \{ data \} = await supabase/);
  });

  it("la recherche applique la même règle", () => {
    const body = reader.slice(
      reader.indexOf("export async function searchLeaderboard"),
    );

    expect(body).toMatch(/challengeableKnown/);
    expect(body).toMatch(/select\("id, display_name"\)/);
  });

  it("sans repère, on n’affiche pas de bouton plutôt qu’un mauvais", () => {
    // On ignore si ce participant accepte les défis : ne rien proposer est la
    // seule réponse honnête.
    expect(reader).toMatch(/challengeable: false/);
    expect(reader).toMatch(/challengeableKnown && row\.duels_opt_out !== true/);
  });
});

describe("aucun calcul n’a bougé", () => {
  it("l’écran ne calcule toujours aucun rang", () => {
    // Tout vient de la vue matérialisée. C'est la garantie de l'epic 7, et
    // cette refonte ne doit pas l'entamer.
    expect(screen).not.toMatch(/\.sort\(|reduce\(|rank\s*=/);
  });

  it("et la lecture ne classe rien elle-même", () => {
    // Le tri est demandé à la base, sur la colonne de rang déjà calculée par la
    // vue matérialisée. (La recherche, elle, a le droit de trier ses résultats :
    // elle remet dans l'ordre des rangs qu'elle a reçus, elle n'en calcule pas.)
    const body = reader.slice(
      reader.indexOf("export async function getLeaderboard"),
      reader.indexOf("function buildRow("),
    );

    expect(body).not.toMatch(/\.sort\(/);
    expect(body).toMatch(/\.order\(definition\.rankColumn/);
  });
});
