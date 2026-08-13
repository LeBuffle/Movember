import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readStravaEvent } from "@/lib/activities/webhook";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Comment les vraies sorties entrent dans le jeu
 *
 * Deux chemins, et aucun ne suffit seul : le webhook est immédiat mais peut
 * se perdre, le rattrapage est fiable mais horaire. Sur l'environnement sans
 * abonnement webhook — Strava n'en autorise qu'un par application — le
 * rattrapage n'est pas un filet, c'est le seul chemin.
 * ====================================================================== */

describe("le rattrapage", () => {
  const sync = code("src/lib/activities/sync.ts");

  it("ne remonte jamais avant le début de l’édition", () => {
    // Rapatrier trois ans de sorties brûlerait le quota, stockerait des
    // données dont le jeu n'a aucun usage, et irait contre la minimisation.
    expect(sync).toMatch(/editionStartDate\(\)/);
    expect(sync).toMatch(/range\.after < start \? start : range\.after/);
  });

  it("lit cette date en base, il ne l’écrit pas dans le code", () => {
    // Elle était écrite en dur au 1ᵉʳ novembre ici, et lue dans
    // `editions.starts_on` par l'évaluation des fils rouges : deux réponses
    // à une même question, sans rien pour les faire concorder. C'est aussi
    // ce qui permet d'ouvrir la préproduction plus tôt sans déploiement.
    expect(sync).not.toMatch(/Date\.UTC\(EDITION_YEAR/);
    expect(code("src/lib/edition/start.ts")).toMatch(/select\("starts_on"\)/);
  });

  it("le dit au lieu d’interroger Strava pour rien avant l’édition", () => {
    // La fenêtre bornée commence alors après sa propre fin : Strava répond
    // une liste vide sans erreur, et un compte relié ressemble à un compte
    // qui n'a fait aucun sport. C'est ce silence qui rendait la panne
    // introuvable.
    expect(sync).toMatch(/after >= range\.before/);
    expect(sync).toMatch(/reason: "before-edition"/);
  });

  it("et le balayage horaire ne lit cette date qu’une fois", () => {
    // Cinq cents requêtes identiques pour apprendre la même date.
    const sweep = sync.slice(sync.indexOf("export async function runCatchUp"));

    expect(sweep).toMatch(/const start = await editionStartDate\(\);/);
    expect(sweep).toMatch(
      /syncOne\(link\.profile_id, provider, undefined, start\)/,
    );
  });

  it("regarde deux jours en arrière, pas une heure", () => {
    // Une livraison perdue dans la nuit, ou un service coupé une matinée,
    // c'est exactement ce pour quoi il existe.
    expect(sync).toMatch(/ROUTINE_WINDOW_DAYS = 2/);
  });

  it("passe par le jeton valide plutôt que par le jeton stocké", () => {
    // Il n'a pas à savoir que les jetons expirent : la story 3.7 répond.
    expect(sync).toMatch(/validAccessToken\(profileId, provider\)/);
  });

  it("entre par la même porte que le webhook", () => {
    // Stocké une fois, évalué une fois, doublons refusés par la base.
    expect(sync).toMatch(/recordActivities\(fetched\.value\)/);
  });

  it("distingue une liaison rompue d’une indisponibilité", () => {
    expect(sync).toMatch(/reason === "denied" \? "broken" : "unavailable"/);
  });

  it("borne ce qu’il traite en un passage", () => {
    expect(sync).toMatch(/MAX_PER_RUN/);
  });

  it("importe toute l’édition à la première liaison", () => {
    // Quelqu'un qui s'inscrit le 12 novembre doit retrouver ses onze premiers
    // jours, pas repartir de zéro — un écran vide après avoir connecté, c'est
    // le moment où on décide que le jeu ne marche pas.
    expect(sync).toMatch(/export async function importInitialActivities/);
    expect(code("src/app/api/activites/retour/[fournisseur]/route.ts")).toMatch(
      /await importInitialActivities\(user\.id, source\.key\)/,
    );
  });

  it("note quand le participant a été atteint", () => {
    expect(sync).toMatch(/last_synced_at: new Date\(\)\.toISOString\(\)/);
  });

  it("a sa ligne de tâche planifiée", () => {
    expect(code("deploy/crontab")).toMatch(/api\/cron\/rattrapage/);
  });
});

describe("le webhook", () => {
  const route = code("src/app/api/webhooks/strava/route.ts");
  const handler = code("src/lib/activities/webhook.ts");

  it("répond au défi d’abonnement avec la clé exacte", () => {
    // Une autre clé fait échouer la poignée de main sans la moindre
    // explication.
    expect(route).toMatch(/"hub\.challenge": challenge/);
    expect(route).toMatch(/STRAVA_WEBHOOK_VERIFY_TOKEN/);
  });

  it("refuse un jeton de vérification qui ne correspond pas", () => {
    expect(route).toMatch(/status: 403/);
  });

  it("répond avant de travailler", () => {
    // Strava rejoue un événement qui n'a pas répondu vite. Enchaîner l'appel
    // de détail et l'évaluation dans la requête, c'est se faire rejouer
    // l'événement pendant qu'on le traite.
    expect(route).toMatch(/after\(async \(\) => \{/);
    expect(route.indexOf("after(async")).toBeLessThan(
      route.indexOf('NextResponse.json({ status: "ok" })'),
    );
  });

  it("répond 200 à une charge illisible plutôt que de la faire rejouer", () => {
    expect(route).toMatch(/status: "ignored"/);
  });

  it("attrape ses propres erreurs de traitement", () => {
    // `after` s'exécute hors requête : une exception y disparaîtrait sans
    // laisser de trace.
    expect(route).toMatch(/catch \(error\)/);
  });

  it("ne stocke jamais rien de la charge reçue", () => {
    // C'est ce qui rend un webhook non signé acceptable : il nomme une
    // activité, et on va la demander à Strava nous-mêmes. Un appel falsifié
    // coûte un appel d'API sur un athlète connu, et ne peut rien injecter.
    expect(handler).toMatch(/source\.fetchActivity\(/);
    expect(handler).not.toMatch(/distance|moving_time|total_elevation/);
  });

  it("écarte un événement pour un athlète qu’on ne connaît pas", () => {
    expect(handler).toMatch(/if \(!profileId\) return "unknown-athlete"/);
  });

  it("traite les trois verbes", () => {
    expect(handler).toMatch(/aspectType === "delete"/);
    expect(handler).toMatch(/aspectType === "update"/);
    expect(handler).toMatch(/recordActivities\(\[fetched\.value\]\)/);
  });

  it("marque la liaison rompue quand le participant nous révoque", () => {
    // Ça lui évite d'attendre que le rafraîchissement horaire s'en aperçoive.
    expect(handler).toMatch(/event\.authorised === false/);
    expect(handler).toMatch(/breakLink/);
  });
});

describe("la lecture d’un événement", () => {
  const base = {
    object_type: "activity",
    aspect_type: "create",
    object_id: 12345,
    owner_id: 999,
  };

  it("accepte une charge conforme", () => {
    expect(readStravaEvent(base)).toEqual({
      objectType: "activity",
      aspectType: "create",
      objectId: "12345",
      ownerId: "999",
      authorised: null,
    });
  });

  it("refuse un verbe ou un objet inconnu", () => {
    expect(readStravaEvent({ ...base, aspect_type: "explode" })).toBe(null);
    expect(readStravaEvent({ ...base, object_type: "segment" })).toBe(null);
  });

  it("refuse une charge sans identifiants exploitables", () => {
    expect(readStravaEvent({ ...base, object_id: null })).toBe(null);
    expect(readStravaEvent({ ...base, owner_id: {} })).toBe(null);
    expect(readStravaEvent(null)).toBe(null);
    expect(readStravaEvent("bonjour")).toBe(null);
  });

  it("lit la révocation d’autorisation, chaîne ou booléen", () => {
    // Strava envoie `"false"` entre guillemets. Le lire comme un booléen
    // donnerait « autorisé » à une révocation.
    const revoked = {
      object_type: "athlete",
      aspect_type: "update",
      object_id: 999,
      owner_id: 999,
      updates: { authorized: "false" },
    };

    expect(readStravaEvent(revoked)?.authorised).toBe(false);
    expect(
      readStravaEvent({ ...revoked, updates: { authorized: true } })
        ?.authorised,
    ).toBe(true);
  });
});

describe("les appels sortants", () => {
  const strava = code("src/lib/activities/sources/strava.ts");

  it("traitent le dépassement de quota comme une indisponibilité", () => {
    // Le quota est partagé par tous les participants : continuer à taper
    // pendant qu'on est limité fait durer la panne pour tout le monde.
    expect(strava).toMatch(/response\.status === 429/);
    expect(strava).toMatch(/quota d’appels atteint/);
  });

  it("distinguent un refus définitif", () => {
    expect(strava).toMatch(/status === 401 \|\| response\.status === 403/);
  });

  it("sont bornés en pages", () => {
    // Un défaut chez l'appelant ne doit pas se transformer en promenade sans
    // fin dans l'historique Strava de quelqu'un.
    expect(strava).toMatch(/MAX_PAGES/);
    expect(strava).toMatch(/PAGE_SIZE = 200/);
  });

  it("s’arrêtent sur une page incomplète", () => {
    expect(strava).toMatch(/batch\.length < PAGE_SIZE/);
  });

  it("ne restent pas suspendus", () => {
    expect(strava).toMatch(/AbortSignal\.timeout\(TIMEOUT_MS\)/);
  });
});

describe("l’état de la connexion, côté participant", () => {
  const actions = code("src/lib/activities/sync-actions.ts");
  const page = code("src/app/(participant)/mon-compte/activites/page.tsx");

  it("montre la date de dernière vérification", () => {
    expect(page).toMatch(/Dernière vérification le/);
  });

  it("limite la resynchronisation manuelle", () => {
    // Quelqu'un qui attend une activité appuiera dix fois, et dix appels par
    // personne mangent le quota de tout le monde.
    expect(actions).toMatch(/RESYNC_INTERVAL_MS = 5 \* 60 \* 1000/);
    expect(actions).toMatch(/Date\.now\(\) - last < RESYNC_INTERVAL_MS/);
  });

  it("révoque chez Strava avant de délier chez nous", () => {
    // L'inverse dirait au participant qu'il est déconnecté alors que
    // l'autorisation est toujours vivante — le seul résultat interdit.
    const disconnect = actions.slice(
      actions.indexOf("export async function disconnectAccount"),
    );

    expect(disconnect.indexOf("source.revoke(")).toBeLessThan(
      disconnect.indexOf("unlinkAccount(user.id)"),
    );
  });

  it("ne délie pas si Strava n’a pas répondu", () => {
    expect(actions).toMatch(/votre compte est toujours relié/);
  });

  it("dit que ce qui est acquis le reste", () => {
    expect(
      code("src/components/activities/connection-panel.tsx").replace(
        /\s+/g,
        " ",
      ),
    ).toMatch(/défis déjà réussis et vos points restent acquis/);
  });
});

describe("le comportement dégradé", () => {
  const health = code("src/lib/activities/health.ts");

  it("se déduit des données, pas d’un compteur en mémoire", () => {
    // Un compteur se remet à zéro à chaque redémarrage du conteneur — soit
    // exactement pendant un incident — et dirait « tout va bien » au pire
    // moment.
    expect(health).toMatch(/from\("activity_connections"\)/);
    expect(health).not.toMatch(/let\s+\w+\s*=\s*0;/);
  });

  it("distingue une panne d’une perturbation", () => {
    expect(health).toMatch(/share === 0 \? "down"/);
    expect(health).toMatch(/DEGRADED_BELOW/);
  });

  it("ne confond pas « personne n’a relié » avec une panne", () => {
    expect(health).toMatch(/state: "idle"/);
  });

  it("le dit au participant sans jargon", () => {
    // De là où il est, une panne de Strava et un jeu cassé se ressemblent.
    const jeu = code("src/app/(participant)/jeu/page.tsx").replace(/\s+/g, " ");

    expect(jeu).toMatch(/Vos sorties tardent à remonter/);
    expect(jeu).toMatch(/défis restent ouverts et se valideront tout seuls/);
  });

  it("donne à l’organisation un écran qui répond « nous ou Strava »", () => {
    const etat = code("src/app/(admin)/admin/etat/page.tsx");

    expect(etat).toMatch(/Plus aucune sortie ne remonte/);
    expect(etat).toMatch(/Aucun défi n’est marqué manqué/);
  });

  it("ne sonde rien en direct", () => {
    // Interroger Strava à chaque affichage dépenserait le quota pour répondre
    // à une question que les liaisons renseignent déjà.
    expect(code("src/app/(admin)/admin/etat/page.tsx")).not.toMatch(
      /fetchActivities|fetch\(/,
    );
  });

  it("ne marque jamais un défi manqué automatiquement", () => {
    // Le point qui compte vraiment : pendant une panne, rien ne doit basculer
    // en « manqué ». Seul l'arbitrage manuel le fait, avec un motif.
    for (const file of [
      "src/lib/challenges/completion.ts",
      "src/lib/activities/sync.ts",
      "src/lib/activities/webhook.ts",
      "src/lib/activities/store.ts",
    ]) {
      expect(code(file)).not.toMatch(/status: "missed"/);
    }

    expect(code("src/lib/challenges/arbitration-actions.ts")).toMatch(
      /status: "missed"/,
    );
  });
});
