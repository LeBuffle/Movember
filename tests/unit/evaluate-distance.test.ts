import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  addDays,
  matchesSport,
  sportFamilyFromProvider,
  withinWindow,
  type Activity,
} from "@/lib/activities/activity";
import {
  simulatedActivities,
  simulatedActivitiesForDay,
} from "@/lib/activities/simulated";
import {
  evaluate,
  evaluateDistance,
  isEvaluable,
  judgedWindow,
  type EvaluationContext,
} from "@/lib/challenges/evaluators/evaluate";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Les cas limites sont exactement ce qui produit une réclamation
 *
 * « J'ai couru, ça n'a pas compté » n'a qu'une seule bonne réponse : une
 * règle qu'on peut lui montrer. D'où une fonction pure et un tableau de cas.
 * ====================================================================== */

const DAY = "2026-11-15";

/** L'écriture de la réussite vit en base depuis la story 5.3. */
const grantFunction = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260806140000_grant_card_with_completion.sql",
  ),
  "utf8",
).replace(/--.*$/gm, "");

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    provider: "simulated",
    profileId: "profil-1",
    name: "Footing",
    sportFamily: "run",
    startedAt: `${DAY}T07:00:00.000Z`,
    localDate: DAY,
    distanceMeters: 5000,
    durationSeconds: 1680,
    elevationMeters: 30,
    isManual: false,
    isPrivate: false,
    ...overrides,
  };
}

const CONFIG = {
  min_distance_meters: 5000,
  sport_types: ["run"],
  window: "day",
};

const CONTEXT: EvaluationContext = { assignedFor: DAY, durationDays: 1 };

const judge = (
  act: Partial<Activity> = {},
  config: Record<string, unknown> = CONFIG,
  context: EvaluationContext = CONTEXT,
) => evaluateDistance({ activity: activity(act), config, context });

describe("le défi de distance", () => {
  it("est réussi au seuil exact", () => {
    // Le mètre près. Un défi qui demande 5 km est réussi par 5 000 m pile —
    // discuter d'un mètre avec un participant est un combat que personne ne
    // gagne.
    const verdict = judge({ distanceMeters: 5000 });

    expect(verdict.completed).toBe(true);
  });

  it("est réussi au-dessus du seuil", () => {
    expect(judge({ distanceMeters: 5001 }).completed).toBe(true);
  });

  it("n’est pas réussi un mètre en dessous", () => {
    const verdict = judge({ distanceMeters: 4999 });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed && "measured" in verdict) {
      expect(verdict.measured).toBe(4999);
      expect(verdict.target).toBe(5000);
    }
  });

  it("refuse un sport qui n’est pas dans la liste", () => {
    const verdict = judge({ sportFamily: "bike", distanceMeters: 24000 });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed) expect(verdict.reason).toMatch(/sport/i);
  });

  it("accepte tous les sports quand le défi le dit", () => {
    expect(
      judge(
        { sportFamily: "bike", distanceMeters: 24000 },
        { ...CONFIG, sport_types: ["any"] },
      ).completed,
    ).toBe(true);
  });

  it("refuse une activité que le fournisseur n’a pas su classer", () => {
    // `any` côté activité veut dire « inconnu ». Un défi qui a nommé ses
    // sports ne doit pas être validé par une activité qu'on n'a pas su
    // ranger.
    expect(judge({ sportFamily: "any", distanceMeters: 9000 }).completed).toBe(
      false,
    );
  });

  it("refuse l’activité de la veille", () => {
    const verdict = judge({ localDate: addDays(DAY, -1) });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed) expect(verdict.reason).toMatch(/période/i);
  });

  it("refuse l’activité du lendemain", () => {
    expect(judge({ localDate: addDays(DAY, 1) }).completed).toBe(false);
  });

  it("accepte le lendemain sur un défi de plusieurs jours", () => {
    expect(
      judge(
        { localDate: addDays(DAY, 1) },
        { ...CONFIG, window: "multi_day" },
        { assignedFor: DAY, durationDays: 3 },
      ).completed,
    ).toBe(true);
  });

  it("accepte aussi une sortie antérieure au tirage : un fil rouge est rétroactif", () => {
    // Décision du PO du 11 août. Un défi sur plusieurs jours mesure une
    // habitude, et l'habitude n'a pas commencé le matin du tirage. Sans cela,
    // tout fil rouge long devenait impossible dans la dernière semaine du
    // mois, et en recevoir un était une punition pour malchance.
    expect(
      judge(
        { localDate: addDays(DAY, -2) },
        { ...CONFIG, window: "multi_day" },
        { assignedFor: DAY, durationDays: 3, editionStartsOn: "2026-11-01" },
      ).completed,
    ).toBe(true);
  });

  it("mais jamais avant le premier jour de l’édition", () => {
    // L'entraînement d'octobre ne valide rien : le premier classement du mois
    // se déciderait avant que le mois n'ait commencé.
    expect(
      judge(
        { localDate: "2026-10-31" },
        { ...CONFIG, window: "multi_day" },
        {
          assignedFor: "2026-11-02",
          durationDays: 10,
          editionStartsOn: "2026-11-01",
        },
      ).completed,
    ).toBe(false);
  });

  it("et la fenêtre glisse avec l’activité jugée, sans jamais la dépasser", () => {
    // Elle se termine sur le jour de la sortie évaluée : un défi n'est jamais
    // validé sur des journées qui n'ont pas encore eu lieu.
    const window = judgedWindow(
      {
        activity: activity({ localDate: addDays(DAY, 5) }),
        config: { ...CONFIG, window: "multi_day" },
        context: {
          assignedFor: DAY,
          durationDays: 3,
          editionStartsOn: "2026-11-01",
        },
      },
      3,
    );

    expect(window.to).toBe(addDays(DAY, 5));
    expect(window.from).toBe(addDays(DAY, 3));
  });

  it("un défi de la journée, lui, reste celui du jour où il a été donné", () => {
    // Le rendre rétroactif offrirait un défi déjà réussi avant d'ouvrir
    // l'application.
    const window = judgedWindow(
      {
        activity: activity({ localDate: addDays(DAY, -1) }),
        config: CONFIG,
        context: { assignedFor: DAY, durationDays: 1 },
      },
      1,
    );

    expect(window.from).toBe(DAY);
    expect(window.to).toBe(DAY);
  });

  it("refuse une activité sans distance", () => {
    // Une séance de renforcement ne parcourt rien. Ce n'est pas une anomalie,
    // et l'évaluateur doit la refuser sur le chiffre, pas trébucher dessus.
    expect(judge({ sportFamily: "run", distanceMeters: 0 }).completed).toBe(
      false,
    );
  });

  it("refuse un défi sans objectif plutôt que de le déclarer réussi", () => {
    const verdict = judge({}, { ...CONFIG, min_distance_meters: 0 });

    expect(verdict.completed).toBe(false);
    expect("unsupported" in verdict).toBe(true);
  });

  it("dit ce qui l’a validé", () => {
    // « Réussi » tout court appelle le message que tout organisateur redoute :
    // « réussi avec quoi ? »
    const verdict = judge({ id: "act-42", distanceMeters: 6200 });

    expect(verdict.completed).toBe(true);
    if (verdict.completed) {
      expect(verdict.evidence.activityIds).toEqual(["act-42"]);
      expect(verdict.evidence.measured).toBe(6200);
    }
  });

  it("ne somme pas deux activités de la journée", () => {
    // Deux sorties de 3 km ne font pas un défi de 5 km ici. Les deux lectures
    // se défendent — celle-ci suit le critère d'acceptation, et permet de
    // trancher un défi dès qu'une activité arrive plutôt qu'en fin de
    // journée. Cumuler est une autre mécanique.
    expect(judge({ distanceMeters: 3000 }).completed).toBe(false);
    expect(judge({ distanceMeters: 3000 }).completed).toBe(false);
  });

  it("ne dépend d’aucune horloge ni d’aucune base", () => {
    // La pureté est ce qui rend ce tableau de cas possible.
    const evaluator = code("src/lib/challenges/evaluators/evaluate.ts");

    expect(evaluator).not.toMatch(/new Date\(|Date\.now|createClient|fetch\(/);
    expect(evaluator).not.toMatch(/server-only/);
  });
});

describe("ce qui ne peut pas être jugé", () => {
  it("refuse explicitement plutôt que de dire « manqué »", () => {
    // « Pas encore jugé » et « jugé et raté » sont deux réponses différentes.
    // Les confondre distribuerait des défis manqués incontestables. Ici, une
    // régularité sans historique (story 4.7).
    const verdict = evaluate("streak", {
      activity: activity(),
      config: { days: 5, sport_types: ["run"] },
      context: CONTEXT,
    });

    expect(verdict.completed).toBe(false);
    expect("unsupported" in verdict).toBe(true);
  });

  it("distingue un type connu d’un type inventé", () => {
    expect(isEvaluable("distance")).toBe(true);
    expect(isEvaluable("streak")).toBe(true);
    expect(isEvaluable("téléportation")).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Le modèle d'activité
 * ------------------------------------------------------------------------ */

describe("l’activité normalisée", () => {
  it("réduit le vocabulaire de Strava au nôtre", () => {
    expect(sportFamilyFromProvider("TrailRun")).toBe("run");
    expect(sportFamilyFromProvider("VirtualRide")).toBe("bike");
    expect(sportFamilyFromProvider("Hike")).toBe("walk");
  });

  it("ne perd pas une activité qu’elle ne sait pas classer", () => {
    // La jeter serait pire : elle existe, elle a eu lieu.
    expect(sportFamilyFromProvider("Kitesurf")).toBe("any");
  });

  it("compare les jours comme des chaînes, sans fuseau horaire", () => {
    // Construire une date ici ferait entrer le fuseau du serveur dans une
    // décision qui ne parle que de jours du calendrier.
    expect(withinWindow("2026-11-15", "2026-11-15", 1)).toBe(true);
    expect(withinWindow("2026-11-16", "2026-11-15", 1)).toBe(false);
    expect(withinWindow("2026-11-16", "2026-11-15", 2)).toBe(true);
    expect(withinWindow("2026-11-14", "2026-11-15", 5)).toBe(false);
  });

  it("passe les fins de mois", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("traite une durée de fenêtre absurde comme une journée", () => {
    expect(withinWindow("2026-11-16", "2026-11-15", 0)).toBe(false);
    expect(withinWindow("2026-11-15", "2026-11-15", -3)).toBe(true);
  });

  it("laisse « tous sports » tout accepter", () => {
    expect(matchesSport(activity({ sportFamily: "swim" }), ["any"])).toBe(true);
    expect(matchesSport(activity({ sportFamily: "swim" }), ["run"])).toBe(
      false,
    );
  });
});

describe("les activités simulées", () => {
  it("sont identiques d’une exécution à l’autre", () => {
    // Un test qui passe le mardi et échoue le mercredi vaut moins que pas de
    // test du tout.
    expect(simulatedActivities(DAY)).toEqual(simulatedActivities(DAY));
  });

  it("couvrent les cas qui font douter", () => {
    const ids = simulatedActivities(DAY).map((a) => a.id);

    expect(ids).toContain("sim-run-5k");
    expect(ids).toContain("sim-run-just-short");
    expect(ids).toContain("sim-strength");
    expect(ids).toContain("sim-run-yesterday");
  });

  it("datent par rapport au jour demandé, pas par rapport à aujourd’hui", () => {
    const veille = simulatedActivities(DAY).find(
      (a) => a.id === "sim-run-yesterday",
    );

    expect(veille?.localDate).toBe(addDays(DAY, -1));
  });

  it("se restreignent à la journée quand on le demande", () => {
    const day = simulatedActivitiesForDay(DAY);

    expect(day.length).toBeGreaterThan(0);
    expect(day.every((a) => a.localDate === DAY)).toBe(true);
  });

  it("valident le défi attendu, et lui seul", () => {
    // Le banc d'essai du back-office repose là-dessus : un 5 km laisse passer
    // la sortie de 5 km et la sortie longue, pas les 4 999 m ni la marche.
    const passing = simulatedActivitiesForDay(DAY)
      .filter(
        (act) =>
          evaluateDistance({ activity: act, config: CONFIG, context: CONTEXT })
            .completed,
      )
      .map((act) => act.id);

    // `sim-manual-entry` en fait partie, et c'est la vérité du moment : une
    // sortie saisie à la main valide aujourd'hui les défis comme une autre.
    // Le PO a tranché qu'elles seraient écartées (point P11), mais le filtre
    // est la story 9.8 — et ce test le dira le jour où il arrivera.
    expect(passing).toEqual(["sim-run-5k", "sim-run-long", "sim-manual-entry"]);
  });

  it("n’inventent aucun hasard", () => {
    const source = code("src/lib/activities/simulated.ts");

    expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(\)/);
  });
});

/* ---------------------------------------------------------------------------
 * L'enregistrement
 * ------------------------------------------------------------------------ */

describe("l’enregistrement d’une réussite", () => {
  const completion = code("src/lib/challenges/completion.ts");

  it("ne regarde que les défis encore ouverts", () => {
    expect(completion).toMatch(/\.eq\("status", "open"\)/);
  });

  it("ne revalide pas un défi déjà réussi", () => {
    // La condition est portée par l'écriture elle-même : c'est la seule qui
    // tienne quand deux activités arrivent au même instant.
    //
    // Depuis la story 5.3, cette écriture vit dans une fonction en base — le
    // défi et sa carte doivent basculer dans la même transaction.
    expect(grantFunction).toMatch(
      /set status = 'completed'[\s\S]*?and status = 'open'/,
    );
  });

  it("recopie les points au moment de la réussite", () => {
    // La valeur du catalogue peut être corrigée en cours d'édition ; ce qui
    // est gagné ne doit pas bouger.
    expect(grantFunction).toMatch(/points_awarded = p_points/);
  });

  it("attribue la carte dans la même transaction", () => {
    // Le point d'attention de tout l'epic 5 : une erreur en cours ne peut pas
    // laisser un participant avec un défi validé et pas de carte.
    expect(grantFunction).toMatch(/insert into public\.card_grants/);
    expect(grantFunction).toMatch(/on conflict \(assignment_id\)/);
  });

  it("valide le défi même sans carte disponible", () => {
    // En septembre le catalogue est vide. Un défi sans carte est un dommage ;
    // un défi qui ne se valide pas est un défaut.
    expect(grantFunction).toMatch(/if p_card_id is not null then/);
  });

  it("garde la trace de ce qui a validé", () => {
    expect(completion).toMatch(/p_evidence:/);
  });

  it("revérifie la configuration avant de juger", () => {
    // Une fiche modifiée en SQL doit arrêter l'évaluation, pas être jugée sur
    // ce qu'elle contient par hasard.
    expect(completion).toMatch(/readChallengeConfig\(/);
  });
});
