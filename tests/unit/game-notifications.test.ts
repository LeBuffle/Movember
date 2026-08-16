import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  completionMessage,
  dailyChallengeMessage,
} from "@/lib/notifications/messages";

/* =========================================================================
 * Les deux notifications que le jeu produit (stories 6.5 et 6.6)
 *
 * Celle du matin est ce qui fait revenir les participants : une application
 * de jeu quotidien sans rappel quotidien perd ses joueurs en une semaine.
 * Celle du soir est ce qui fait que la récompense arrive au moment de
 * l'effort — mais groupée, parce que trois notifications d'affilée sont du
 * bruit, et que le bruit se désactive.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const game = code(read("src/lib/notifications/game.ts"));
const store = code(read("src/lib/activities/store.ts"));
const cron = code(read("src/app/api/cron/defis-du-jour/route.ts"));
const adminActions = code(read("src/lib/challenges/admin-actions.ts"));
const completion = code(read("src/lib/challenges/completion.ts"));

describe("la notification du défi du jour", () => {
  it("porte le titre du défi, pas une phrase générique", () => {
    // AC 2. « 5 km avant le café » donne envie ; « vous avez un nouveau
    // défi » se balaie sans lire.
    const payload = dailyChallengeMessage(["5 km avant le café"]);

    expect(payload?.body).toBe("5 km avant le café");
  });

  it("annonce les deux quand il y en a deux", () => {
    const payload = dailyChallengeMessage(["5 km", "300 m de dénivelé"]);

    expect(payload?.title).toMatch(/2 défis/);
    expect(payload?.body).toMatch(/5 km/);
    expect(payload?.body).toMatch(/dénivelé/);
  });

  it("ne dit rien quand il n'y a rien", () => {
    // AC 4 : un participant sans défi ce jour-là ne reçoit rien.
    expect(dailyChallengeMessage([])).toBeNull();
  });

  it("ouvre l'écran du jeu", () => {
    // AC 5.
    expect(dailyChallengeMessage(["5 km"])?.url).toBe("/jeu");
  });

  it("relit les attributions du jour au lieu de croire le tirage", () => {
    // Les deux divergent dans le cas qui compte : une tâche relancée à neuf
    // heures parce que celle de six avait l'air bizarre. Le tirage annonce
    // alors zéro nouvelle attribution alors que huit cents personnes ont bien
    // un défi.
    const region = game.slice(
      game.indexOf("export async function notifyDailyChallenges"),
    );

    expect(region).toMatch(/from\("challenge_assignments"\)/);
    expect(region).toMatch(/\.eq\("assigned_for", date\)/);
  });

  it("se réserve sur la date, pas sur le contenu", () => {
    // AC 6. Une relance ne doit pas produire un second message en groupant
    // les gens autrement.
    expect(game).toMatch(/dedupeKey: `defi-du-jour:\$\{date\}`/);
  });

  it("groupe les participants qui ont le même défi", () => {
    // La plupart ont exactement un défi, et beaucoup le même : envoyer
    // personne par personne, ce serait huit cents expéditions distinctes.
    expect(game).toMatch(/const groups = new Map/);
  });
});

describe("la notification n'empêche jamais l'attribution", () => {
  it("elle est appelée après le tirage, pas pendant", () => {
    // AC 7. Un envoi qui échoue ne doit pas laisser quelqu'un devant un écran
    // vide alors que son défi existait.
    const drawAt = cron.indexOf("assignDailyChallenges()");
    const notifyAt = cron.indexOf("notifyDailyChallenges(");

    expect(drawAt).toBeGreaterThan(-1);
    expect(drawAt).toBeLessThan(notifyAt);
  });

  it("le tirage manuel appelle exactement la même chose", () => {
    // Une seconde version faite à la main finirait par diverger de la vraie,
    // le matin où on en aurait besoin.
    expect(adminActions).toMatch(/notifyDailyChallenges\(report\.date\)/);
  });
});

describe("la notification de validation, groupée", () => {
  it("trois défis validés ensemble donnent un seul message", () => {
    // AC 2. C'est le cas réel : une longue sortie du dimanche valide une
    // distance, un dénivelé et un cumul d'un coup.
    const payload = completionMessage([
      { title: "5 km", cardGranted: true },
      { title: "300 m D+", cardGranted: true },
      { title: "Trois sorties", cardGranted: false },
    ]);

    expect(payload).not.toBeNull();
    expect(payload?.title).toMatch(/3 défis réussis/);
  });

  it("dit combien de cartes", () => {
    // AC 3.
    const payload = completionMessage([
      { title: "5 km", cardGranted: true },
      { title: "300 m D+", cardGranted: true },
    ]);

    expect(payload?.body).toMatch(/2 cartes/);
  });

  it("mène à l'écran de découverte quand il y a une carte", () => {
    // AC 4, et c'est le moment sur lequel vit toute la collection.
    const withCard = completionMessage([{ title: "5 km", cardGranted: true }]);
    const without = completionMessage([{ title: "5 km", cardGranted: false }]);

    expect(withCard?.url).toBe("/jeu/collection/reveler");
    expect(without?.url).toBe("/jeu");
  });

  it("porte la même étiquette, pour remplacer et non empiler", () => {
    expect(
      completionMessage([{ title: "5 km", cardGranted: false }])?.tag,
    ).toBe("defis-valides");
  });

  it("ne dit rien quand rien n'a été validé", () => {
    expect(completionMessage([])).toBeNull();
  });

  it("est envoyée une fois par lot d'activités, pas par activité", () => {
    // Le lot est l'unité naturelle : une sortie arrive, est enregistrée, et
    // règle trois défis. C'est un événement, tel que le participant l'a vécu.
    const region = store.slice(
      store.indexOf("export async function recordActivities"),
    );

    expect(region).toMatch(/const completed = new Map/);
    // L'appel est hors de la boucle qui parcourt les activités.
    expect(region.indexOf("notifyCompletions")).toBeGreaterThan(
      region.indexOf("for (const activity of activities)"),
    );
    expect(region).toMatch(
      /for \(const \[profileId, completions\] of completed\)/,
    );
  });

  it("ne bascule jamais en e-mail", () => {
    // Architecture D6 : un défi validé ne vaut plus rien le temps qu'un
    // e-mail soit lu.
    expect(game).toMatch(/category: "resultat"/);
    expect(code(read("src/lib/notifications/payload.ts"))).toMatch(
      /ESSENTIAL_CATEGORIES[\s\S]*?"defi_du_jour",\s*"annonce",\s*"relance",/,
    );
  });

  it("se réserve sur l'ensemble exact des défis", () => {
    // La vraie garde est en amont — un défi déjà validé ne se revalide pas —
    // donc cette clé est faite pour distinguer, pas pour ratisser : quelqu'un
    // qui valide un défi le matin et un autre l'après-midi doit être prévenu
    // des deux.
    expect(game).toMatch(/function batchKey/);
    expect(game).toMatch(/\.sort\(\)/);
  });
});

describe("ce que la validation renvoie", () => {
  it("porte les titres et la carte, pas seulement un compte", () => {
    // Sans cela, impossible d'écrire un message qui nomme les défis.
    expect(completion).toMatch(/completions: CompletedChallenge\[\]/);
    expect(completion).toMatch(/cardGranted: Boolean\(outcome\.card_id\)/);
  });
});
