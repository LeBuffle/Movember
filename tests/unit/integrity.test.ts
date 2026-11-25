import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Activity } from "@/lib/activities/activity";
import { DEFAULT_THRESHOLDS, evaluateIntegrity } from "@/lib/integrity/rules";

/* =========================================================================
 * Intégrité du jeu (stories 9.6 à 9.9)
 *
 * **Signaler, jamais rejeter** (architecture D10). La raison est sociale :
 * un faux positif qui invalide le défi d'un participant honnête fait plus de
 * dégâts qu'un tricheur qui passe. Le premier arrête de jouer et le raconte ;
 * le second gagne un classement auquel personne ne tient vraiment.
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
  read("supabase/migrations/20260806260000_activity_flags.sql"),
);
const completion = code(read("src/lib/challenges/completion.ts"));
const store = code(read("src/lib/activities/store.ts"));
const flags = code(read("src/lib/integrity/flags.ts"));
const actions = code(read("src/lib/integrity/actions.ts"));
const queuePage = code(read("src/app/(admin)/admin/arbitrage/page.tsx"));
const decision = code(read("src/components/admin/flag-decision.tsx"));
const activitiesScreen = code(
  read("src/app/(participant)/mon-compte/activites/page.tsx"),
);

/** Une sortie ordinaire, que rien ne doit signaler. */
function outing(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    provider: "strava",
    profileId: "p1",
    name: "Sortie",
    sportFamily: "run",
    startedAt: "2026-11-03T07:00:00Z",
    localDate: "2026-11-03",
    distanceMeters: 10_000,
    durationSeconds: 3_000, // 12 km/h
    elevationMeters: 100,
    isManual: false,
    ...overrides,
  } as Activity;
}

describe("une sortie ordinaire n'est jamais signalée", () => {
  it("douze kilomètres à l'heure ne dérangent personne", () => {
    expect(evaluateIntegrity(outing())).toEqual([]);
  });

  it("ni une sortie longue mais crédible", () => {
    // Quatre heures de vélo à 28 km/h : un dimanche ordinaire.
    expect(
      evaluateIntegrity(
        outing({
          sportFamily: "bike",
          distanceMeters: 112_000,
          durationSeconds: 14_400,
          elevationMeters: 1_200,
        }),
      ),
    ).toEqual([]);
  });
});

describe("les règles de cohérence", () => {
  it("signalent une vitesse impossible en course à pied", () => {
    const [flag] = evaluateIntegrity(
      outing({ distanceMeters: 20_000, durationSeconds: 1_800 }), // 40 km/h
    );

    expect(flag.rule).toMatch(/course à pied/);
    expect(flag.observed).toBe(40);
    expect(flag.threshold).toBe(DEFAULT_THRESHOLDS.maxRunSpeedKmh);
  });

  it("n'appliquent pas le seuil de course au vélo", () => {
    // 40 km/h à vélo est rapide, pas impossible.
    expect(
      evaluateIntegrity(
        outing({
          sportFamily: "bike",
          distanceMeters: 20_000,
          durationSeconds: 1_800,
        }),
      ),
    ).toEqual([]);
  });

  it("signalent une durée démesurée", () => {
    const found = evaluateIntegrity(
      outing({ durationSeconds: 15 * 3600, distanceMeters: 60_000 }),
    );

    expect(found.some((flag) => /Durée/.test(flag.rule))).toBe(true);
  });

  it("signalent un dénivelé impossible pour la distance", () => {
    const found = evaluateIntegrity(
      outing({ distanceMeters: 5_000, elevationMeters: 3_000 }), // 600 m/km
    );

    expect(found.some((flag) => /Dénivelé/.test(flag.rule))).toBe(true);
  });

  it("enregistrent la valeur constatée, pas seulement la règle", () => {
    // « Vitesse moyenne 40 km/h » se juge ; « activité suspecte » ne se juge
    // pas, et ferait de la file un endroit où l'on appuie sans savoir.
    const [flag] = evaluateIntegrity(
      outing({ distanceMeters: 20_000, durationSeconds: 1_800 }),
    );

    expect(flag.observed).toBeGreaterThan(0);
    expect(flag.unit).toBe("km/h");
  });

  it("se taisent quand la sortie ne dit rien de sa vitesse", () => {
    // Une durée nulle donnerait une vitesse infinie, signalée comme une
    // certitude.
    expect(
      evaluateIntegrity(outing({ durationSeconds: 0, distanceMeters: 0 })),
    ).toEqual([]);
  });

  it("suivent les seuils qu'on leur passe", () => {
    // Le réglage vit en base (story 9.9) : un excès de faux positifs le
    // troisième jour se corrige sans redéploiement.
    const strict = { ...DEFAULT_THRESHOLDS, maxRunSpeedKmh: 10 };

    expect(evaluateIntegrity(outing(), strict)).toHaveLength(1);
    expect(evaluateIntegrity(outing())).toHaveLength(0);
  });
});

describe("une sortie saisie à la main ne valide rien", () => {
  it("l'évaluation s'arrête avant de regarder un seul défi", () => {
    // Le drapeau existait depuis la story 3.4 et rien ne l'utilisait : une
    // sortie tapée à la main validait un défi comme une autre.
    const region = completion.slice(
      completion.indexOf("export async function applyActivity"),
    );

    expect(region).toMatch(/if \(activity\.isManual\)/);
    expect(region.indexOf("if (activity.isManual)")).toBeLessThan(
      region.indexOf("challenge_assignments"),
    );
  });

  it("et elle n'entre pas non plus dans un cumul", () => {
    // Sans cela, elle contribuerait à un défi cumulé sans avoir été jugée.
    expect(completion).toMatch(/\.eq\("is_manual", false\)/);
  });

  it("la règle est appliquée à un seul endroit", () => {
    // Une règle répétée sept fois est une règle qui tiendra à six endroits.
    expect(completion.match(/activity\.isManual/g)).toHaveLength(1);
  });

  it("elle n'est pas signalée non plus", () => {
    // Rien à arbitrer : le défi n'a jamais été validé.
    expect(
      evaluateIntegrity(outing({ isManual: true, durationSeconds: 60 })),
    ).toEqual([]);
  });

  it("et le participant l'apprend sur son écran", () => {
    // Une sortie qui remonte et ne valide rien, sans explication, est un
    // message au support.
    expect(activitiesScreen).toMatch(/saisies à la main/);
    expect(activitiesScreen).toMatch(/importée depuis une montre/);
  });
});

describe("signaler n'est jamais rejeter", () => {
  it("le signalement vient après l'évaluation, et ne la touche pas", () => {
    const region = store.slice(store.indexOf("for (const activity of"));

    expect(region.indexOf("applyActivity")).toBeLessThan(
      region.indexOf("flagActivity"),
    );
  });

  it("rien dans le signalement ne modifie un défi ni des points", () => {
    expect(flags).not.toMatch(/challenge_assignments|points_awarded/);
    expect(flags).not.toMatch(/\.update\(/);
  });

  it("et l'écran d'arbitrage le dit à chaque cas", () => {
    expect(decision).toMatch(/ne retire aucun point/);
    expect(queuePage).toMatch(/signaler n’est pas rejeter/);
  });
});

describe("la file d'arbitrage", () => {
  it("n'ouvre aucune écriture en base, pour personne", () => {
    // La sécurité au niveau des lignes filtre des LIGNES, pas des COLONNES :
    // qui pourrait écrire `status` pourrait écarter son propre signalement.
    // Les signalements sont posés par la clé de service, et l'arbitrage passe
    // par une action serveur qui vérifie le rôle.
    const flagSection = migration.slice(
      migration.indexOf("create table public.activity_flags"),
    );

    expect(flagSection).not.toMatch(/for insert|for update|for all|for delete/);
  });

  it("et les participants ne la lisent pas", () => {
    // Savoir qu'on a été signalé, et pour quelle règle, c'est savoir quoi
    // ajuster.
    const flagPolicies = migration.slice(
      migration.indexOf("create table public.activity_flags"),
    );

    expect(flagPolicies).toMatch(/is_admin/);
    expect(flagPolicies).not.toMatch(/to anon/);
  });

  it("ne signale une activité qu'une fois par règle", () => {
    // Une resynchronisation ne doit pas faire réapparaître un cas tranché.
    expect(migration).toMatch(/create unique index activity_flags_once/);
  });

  it("porte sa garde dans l'écriture", () => {
    expect(actions).toMatch(/\.eq\("status", "pending"\)/);
  });

  it("exige un motif", () => {
    expect(actions).toMatch(/reason\.length < 3 \|\| reason\.length > 500/);
  });

  it("journalise les deux décisions", () => {
    expect(actions).toMatch(/activity\.accepted/);
    expect(actions).toMatch(/activity\.dismissed/);
  });

  it("et une file vide se dit comme une bonne nouvelle", () => {
    expect(queuePage).toMatch(/La file est vide/);
    expect(queuePage).toMatch(/état normal/);
  });
});

describe("les seuils sont réglables sans redéploiement", () => {
  it("ils vivent en base", () => {
    expect(migration).toMatch(/create table public\.integrity_settings/);
    expect(flags).toMatch(/from\("integrity_settings"\)/);
  });

  it("avec une valeur par défaut pour chacun", () => {
    for (const column of [
      "max_run_speed_kmh",
      "max_bike_speed_kmh",
      "max_duration_hours",
      "max_elevation_per_km",
    ]) {
      expect(migration).toMatch(
        new RegExp(`${column} numeric not null default`),
      );
    }
  });

  it("et les participants ne les lisent pas", () => {
    // Ils diraient à un tricheur sous quelle barre rester.
    const region = migration.slice(
      migration.indexOf("create table public.integrity_settings"),
      migration.indexOf("create table public.activity_flags"),
    );

    expect(region).toMatch(/is_admin/);
    expect(region).not.toMatch(/to anon/);
  });

  it("un échec de lecture retombe sur les valeurs par défaut", () => {
    // Des seuils illisibles ne doivent pas éteindre les règles en silence.
    expect(flags).toMatch(/return DEFAULT_THRESHOLDS/);
  });
});
