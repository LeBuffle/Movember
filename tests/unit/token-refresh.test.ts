import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260806110000_connection_refresh.sql"),
  "utf8",
).replace(/--.*$/gm, "");

const refresh = code("src/lib/activities/refresh.ts");

/* =========================================================================
 * Ce qui fait tenir une liaison trente jours
 *
 * Un jeton Strava expire en quelques heures. Sans cette story, une liaison
 * faite le soir meurt le lendemain matin — et le participant l'apprend en
 * perdant un défi, trois jours plus tard.
 * ====================================================================== */

describe("le schéma du rafraîchissement", () => {
  it("prend une réservation avant d’appeler le fournisseur", () => {
    // Strava fait tourner le jeton de rafraîchissement : chaque succès en
    // renvoie un neuf et invalide l'ancien. Deux rafraîchissements lancés au
    // même instant présenteraient le même vieux jeton, et le second casserait
    // la liaison sans que personne n'ait rien fait de mal.
    expect(migration).toMatch(/add column if not exists refreshing_at/);
  });

  it("garde la date de rupture, distincte de l’état", () => {
    // « Rompue depuis le 4 » et « rompue depuis dix minutes » n'appellent pas
    // la même réaction, et l'une des deux n'est pas un incident.
    expect(migration).toMatch(/add column if not exists broken_at/);
  });

  it("n’ouvre toujours aucun accès", () => {
    expect(migration).not.toMatch(/create policy/i);
  });
});

describe("le renouvellement", () => {
  it("se déclenche avant l’expiration, pas après un échec", () => {
    // Attendre la première erreur, c'est perdre cet appel — et l'appel en
    // question est le plus souvent le traitement d'un webhook, donc une
    // activité qui n'arrive jamais.
    expect(refresh).toMatch(/RENEW_WITHIN_MS/);
    expect(refresh).toMatch(/isDue\(row\.expires_at\)/);
  });

  it("prend sa marge plus large que l’intervalle de la tâche", () => {
    // Un jeton qui expire dans cinquante minutes doit être pris par CE
    // passage, sinon il meurt dans l'intervalle entre deux.
    expect(refresh).toMatch(/RENEW_WITHIN_MS = 90 \* 60 \* 1000/);
    expect(code("deploy/crontab")).toMatch(/\* \* \* \*.*api\/cron\/jetons/);
  });

  it("porte la garde sur l’écriture de la réservation", () => {
    // Lire une colonne puis l'écrire ne sérialise rien : la tâche horaire et
    // un webhook peuvent lire la même ligne dans la même milliseconde.
    expect(refresh).toMatch(
      /\.update\(\{ refreshing_at: now\.toISOString\(\) \}\)/,
    );
    expect(refresh).toMatch(/\(claimed \?\? \[\]\)\.length === 0/);
  });

  it("laisse expirer une réservation abandonnée", () => {
    // Un conteneur redémarré en plein vol ne doit pas geler la liaison pour
    // toujours.
    expect(refresh).toMatch(/CLAIM_TIMEOUT_MS/);
    expect(refresh).toMatch(/refreshing_at\.is\.null,refreshing_at\.lt\./);
  });

  it("relâche la réservation à chaque sortie", () => {
    expect(refresh).toMatch(/async function release/);
    // Une seule sortie ne la relâche pas : celle qui réussit, parce qu'elle
    // remet le champ à null dans la même écriture que les nouveaux jetons.
    expect(refresh).toMatch(/refreshing_at: null,/);
  });
});

describe("une liaison rompue", () => {
  it("cesse de réessayer", () => {
    // Le participant a révoqué l'autorisation depuis Strava. Il est dans son
    // droit, et retaper à la porte brûle le quota d'appels de tout le monde
    // sans jamais rétablir quoi que ce soit.
    expect(refresh).toMatch(/refreshed\.reason === "denied"/);
    expect(refresh).toMatch(/markBroken/);
  });

  it("n’est jamais confondue avec une panne de Strava", () => {
    // « Reconnectez-vous » et « réessayez plus tard » ne se disent pas au
    // même moment.
    expect(refresh).toMatch(/reason: "unavailable"/);
    expect(refresh).toMatch(/reason: "broken"/);
  });

  it("est datée et journalisée", () => {
    expect(refresh).toMatch(/broken_at: new Date\(\)\.toISOString\(\)/);
    expect(refresh).toMatch(/liaison rompue/);
  });

  it("traite un chiffré illisible comme une reconnexion à faire", () => {
    // Clé changée, ligne altérée : dans les deux cas la réponse honnête est
    // « refaites la liaison », pas « réessayez ».
    expect(refresh).toMatch(/chiffrement illisible/);
  });
});

describe("aucun jeton ne sort", () => {
  it("n’apparaît dans aucun journal", () => {
    // Un journal se lit, se copie dans un ticket, s'envoie par message. Un
    // jeton qui y traîne ouvre tout l'historique sportif de quelqu'un.
    const logs = [...refresh.matchAll(/console\.\w+\([^)]*\)/g)].map(
      (match) => match[0],
    );

    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toMatch(/access_token|refresh_token|\btoken\b/);
    }
  });

  it("ne quitte jamais le serveur", () => {
    expect(refresh).toMatch(/^import "server-only";/m);
  });
});

describe("la tâche planifiée", () => {
  const route = code("src/app/api/cron/jetons/route.ts");

  it("est protégée par le secret des tâches", () => {
    expect(route).toMatch(/isAuthorisedCronRequest\(request\)/);
  });

  it("répond 200 avec un compte rendu même partiel", () => {
    // Une tâche qui signale un échec pour un passage partiel est une tâche
    // dont on cesse de lire les alertes.
    expect(route).toMatch(/status: 200/);
    expect(route).toMatch(/\.\.\.report/);
  });

  it("borne ce qu’elle traite en un passage", () => {
    expect(refresh).toMatch(/MAX_PER_RUN/);
  });

  it("ignore les liaisons déjà rompues ou déliées", () => {
    expect(refresh).toMatch(/\.eq\("status", "active"\)/);
    expect(refresh).toMatch(/\.is\("disconnected_at", null\)/);
  });
});

describe("la reconnexion en un clic", () => {
  const connection = code("src/lib/activities/connection.ts");
  const page = code("src/app/(participant)/mon-compte/activites/page.tsx");

  it("remplace sa propre liaison au lieu d’entrer en collision", () => {
    // Sans ça, reconnecter une liaison rompue heurte l'index d'unicité et se
    // lit « ce compte appartient à quelqu'un d'autre » — le message le plus
    // alarmant pour la situation la plus ordinaire.
    const link = connection.slice(
      connection.indexOf("export async function linkAccount"),
    );

    expect(link.indexOf("unlinkAccount(profileId, provider)")).toBeLessThan(
      link.indexOf(".insert("),
    );
  });

  it("laisse intacte la liaison d’un autre compte de jeu", () => {
    // C'est ce refus-là qui compte, et il n'est pas touché.
    expect(connection).toMatch(/error\.code === "23505"/);
    expect(connection).toMatch(/reason: "taken"/);
  });

  it("propose le bouton quand la liaison est rompue", () => {
    expect(page).toMatch(/Reconnecter mon compte/);
  });

  it("rassure sur ce qui est conservé", () => {
    // La mise en forme replie les lignes : on compare sur les mots, pas sur
    // les espaces.
    expect(page.replace(/\s+/g, " ")).toMatch(
      /défis déjà réussis sont conservés/,
    );
  });
});
