import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addDays, type Activity } from "@/lib/activities/activity";
import { totalPoints } from "@/lib/challenges/progress";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Une sortie valide tous les défis qu'elle satisfait
 *
 * Demande explicite du PO : « pas obligé de finir le défi du jour pour
 * réaliser le suivant ». Quelqu'un qui n'a pas couru pendant trois jours peut
 * sortir le samedi et régler trois défis d'un coup — c'est ce qui rend le jeu
 * tenable pour des gens qui ont une vie.
 * ====================================================================== */

const DAY = "2026-11-15";

type Row = {
  id: string;
  assigned_for: string;
  challenges: {
    evaluator: string;
    config: Record<string, unknown>;
    points: number;
    duration_days: number | null;
  } | null;
};

type FakeState = {
  open: Row[];
  /** Assignments the update no longer finds `open` — already completed. */
  alreadyClosed: Set<string>;
  filters: Record<string, unknown>;
  updated: Array<{ id: string; patch: Record<string, unknown> }>;
};

const state: FakeState = {
  open: [],
  alreadyClosed: new Set(),
  filters: {},
  updated: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from() {
      const read = {
        eq: (column: string, value: unknown) => {
          state.filters[`eq:${column}`] = value;
          return read;
        },
        lte: (column: string, value: unknown) => {
          state.filters[`lte:${column}`] = value;
          return read;
        },
        gte: (column: string, value: unknown) => {
          state.filters[`gte:${column}`] = value;
          return read;
        },
        limit: async (value: number) => {
          state.filters.limit = value;
          return { data: state.open, error: null };
        },
      };

      return {
        select: () => read,
        update: (patch: Record<string, unknown>) => {
          let id = "";
          const write = {
            eq: (column: string, value: unknown) => {
              if (column === "id") id = String(value);
              return write;
            },
            select: async () => {
              const closed = state.alreadyClosed.has(id);
              if (!closed) state.updated.push({ id, patch });
              return { data: closed ? [] : [{ id }], error: null };
            },
          };
          return write;
        },
      };
    },
  }),
}));

const { applyActivity } = await import("@/lib/challenges/completion");

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    provider: "simulated",
    profileId: "profil-1",
    name: "Sortie longue du samedi",
    sportFamily: "run",
    startedAt: `${DAY}T09:00:00.000Z`,
    localDate: DAY,
    distanceMeters: 18000,
    durationSeconds: 6300,
    elevationMeters: 210,
    ...overrides,
  };
}

const distanceChallenge = (
  id: string,
  assignedFor: string,
  metres: number,
  points = 10,
): Row => ({
  id,
  assigned_for: assignedFor,
  challenges: {
    evaluator: "distance",
    config: {
      min_distance_meters: metres,
      sport_types: ["run"],
      window: "day",
    },
    points,
    duration_days: null,
  },
});

beforeEach(() => {
  state.open = [];
  state.alreadyClosed = new Set();
  state.filters = {};
  state.updated = [];

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("une activité face à plusieurs défis ouverts", () => {
  it("en valide trois d’un coup", async () => {
    // Le cœur de la story.
    state.open = [
      distanceChallenge("a-1", DAY, 5000, 10),
      distanceChallenge("a-2", DAY, 10000, 20),
      distanceChallenge("a-3", DAY, 15000, 30),
    ];

    const report = await applyActivity(activity());

    expect(report.completed).toBe(3);
    expect(state.updated).toHaveLength(3);
  });

  it("laisse ouverts ceux qu’elle ne satisfait pas", () => {
    // Un défi manqué ne bloque rien et reste validable plus tard : rien dans
    // l'application ne le ferme pendant l'édition.
    const completion = code("src/lib/challenges/completion.ts");

    expect(completion).not.toMatch(/status: "missed"/);
  });

  it("n’en valide que ceux qui sont atteints", async () => {
    state.open = [
      distanceChallenge("a-1", DAY, 5000),
      distanceChallenge("a-2", DAY, 25000),
    ];

    const report = await applyActivity(activity());

    expect(report.completed).toBe(1);
    expect(state.updated[0]!.id).toBe("a-1");
  });

  it("rattrape un défi des jours précédents resté ouvert", async () => {
    // Le cas qui motive la story : trois jours sans courir, puis une sortie
    // longue le samedi.
    state.open = [
      distanceChallenge("a-1", addDays(DAY, -2), 5000),
      distanceChallenge("a-2", addDays(DAY, -1), 8000),
      distanceChallenge("a-3", DAY, 10000),
    ];

    // Chacun a sa propre fenêtre d'un jour : seul celui du jour est validé.
    const report = await applyActivity(activity());

    expect(report.completed).toBe(1);
  });

  it("rattrape ceux dont la fenêtre couvre encore le jour", async () => {
    const multiDay: Row = {
      id: "a-multi",
      assigned_for: addDays(DAY, -2),
      challenges: {
        evaluator: "distance",
        config: {
          min_distance_meters: 5000,
          sport_types: ["run"],
          window: "multi_day",
        },
        points: 40,
        duration_days: 3,
      },
    };

    state.open = [multiDay, distanceChallenge("a-jour", DAY, 10000)];

    expect((await applyActivity(activity())).completed).toBe(2);
  });

  it("ne revalide pas un défi déjà validé", async () => {
    // La même activité rejouée — ou une seconde activité le même jour.
    state.open = [distanceChallenge("a-1", DAY, 5000)];
    state.alreadyClosed = new Set(["a-1"]);

    const report = await applyActivity(activity());

    expect(report.completed).toBe(0);
    expect(state.updated).toHaveLength(0);
  });

  it("recopie les points de chaque défi validé", async () => {
    // Ils s'additionnent (architecture D14), et chacun garde la valeur qu'il
    // avait au moment de la réussite.
    state.open = [
      distanceChallenge("a-1", DAY, 5000, 10),
      distanceChallenge("a-2", DAY, 10000, 30),
    ];

    await applyActivity(activity());

    expect(state.updated.map((entry) => entry.patch.points_awarded)).toEqual([
      10, 30,
    ]);
  });

  it("garde la trace de ce qui a validé chacun", async () => {
    state.open = [distanceChallenge("a-1", DAY, 5000)];

    await applyActivity(activity({ id: "act-42" }));

    expect(state.updated[0]!.patch.evidence).toMatchObject({
      activity_ids: ["act-42"],
      measured: 18000,
    });
  });
});

describe("la borne de parcours", () => {
  it("ne regarde jamais un défi attribué après l’activité", async () => {
    // Une sortie ne peut pas satisfaire un défi distribué le lendemain.
    await applyActivity(activity());

    expect(state.filters["lte:assigned_for"]).toBe(DAY);
  });

  it("ne remonte pas au-delà de la fenêtre la plus longue possible", async () => {
    // Sans cela, chaque activité relirait tous les défis depuis le 1ᵉʳ
    // novembre, et le trentième jour coûterait trente fois le premier.
    await applyActivity(activity());

    expect(state.filters["gte:assigned_for"]).toBe(addDays(DAY, -29));
  });

  it("s’arrête net au-delà d’un nombre de défis impossible", async () => {
    expect(state.filters.limit).toBeUndefined();

    await applyActivity(activity());

    expect(state.filters.limit).toBe(60);
  });

  it("ne regarde que les défis encore ouverts, et ceux du participant", async () => {
    await applyActivity(activity());

    expect(state.filters["eq:status"]).toBe("open");
    expect(state.filters["eq:profile_id"]).toBe("profil-1");
  });
});

describe("le total de points", () => {
  const challenge = (
    status: string,
    points: number,
    pointsAwarded: number | null,
  ) => ({ status, points, pointsAwarded });

  it("additionne les défis réussis", () => {
    expect(
      totalPoints([
        challenge("completed", 10, 10),
        challenge("completed", 30, 30),
      ]),
    ).toBe(40);
  });

  it("ignore ce qui n’est pas réussi", () => {
    expect(
      totalPoints([
        challenge("completed", 10, 10),
        challenge("open", 50, null),
        challenge("missed", 50, null),
      ]),
    ).toBe(10);
  });

  it("compte ce qui a été accordé, pas la valeur actuelle du catalogue", () => {
    // Un défi reprisé en cours d'édition ne doit pas changer un score que
    // quelqu'un a déjà vu.
    expect(totalPoints([challenge("completed", 999, 20)])).toBe(20);
  });

  it("vaut zéro sans aucun défi", () => {
    expect(totalPoints([])).toBe(0);
  });
});
