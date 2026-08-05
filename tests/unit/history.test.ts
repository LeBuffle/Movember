import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Un écran de motivation autant que de consultation
 *
 * Le total cumulé est ce que les gens regardent ; le détail sert quand ils
 * contestent un défi manqué — et voir quelle activité a été prise en compte,
 * ou qu'aucune ne l'a été, répond souvent tout seul.
 * ====================================================================== */

type Row = {
  id: string;
  assigned_for: string;
  status: "open" | "completed" | "missed";
  source: string;
  completed_at: string | null;
  points_awarded: number | null;
  evidence: Record<string, unknown> | null;
  challenges: {
    title: string;
    description: string;
    evaluator: string;
    config: Record<string, unknown>;
    points: number;
  } | null;
};

type FakeState = {
  rows: Row[];
  user: { id: string } | null;
  /** What the paginated read was asked for. */
  range: { from: number; to: number } | null;
};

const state: FakeState = { rows: [], user: { id: "profil-1" }, range: null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from() {
      const query = {
        eq: () => query,
        order: () => query,
        limit: async () => ({ data: state.rows, error: null }),
        range: async (from: number, to: number) => {
          state.range = { from, to };
          return { data: state.rows.slice(from, to + 1), error: null };
        },
        then: undefined,
      };

      return {
        select: () => ({
          ...query,
          // The stats read has no `order`/`range`: it awaits the filter.
          eq: (_column: string, _value: unknown) => ({
            ...query,
            then: (resolve: (value: unknown) => void) =>
              resolve({ data: state.rows, error: null }),
          }),
        }),
      };
    },
  }),
}));

const { getChallengeHistory, HISTORY_PAGE_SIZE } =
  await import("@/lib/challenges/assignments");

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: `a-${Math.abs(overrides.assigned_for?.length ?? 1)}`,
    assigned_for: "2026-11-15",
    status: "completed",
    source: "draw",
    completed_at: "2026-11-15T09:00:00.000Z",
    points_awarded: 20,
    evidence: { measured: 6200 },
    challenges: {
      title: "Cinq bornes",
      description: "",
      evaluator: "distance",
      config: {
        min_distance_meters: 5000,
        sport_types: ["run"],
        window: "day",
      },
      points: 20,
    },
    ...overrides,
  };
}

beforeEach(() => {
  state.rows = [];
  state.user = { id: "profil-1" };
  state.range = null;

  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("les totaux de l’historique", () => {
  it("comptent réussis, manqués et encore ouverts", async () => {
    state.rows = [
      row({ id: "a", status: "completed", points_awarded: 20 }),
      row({ id: "b", status: "completed", points_awarded: 30 }),
      row({ id: "c", status: "open", points_awarded: null }),
      row({ id: "d", status: "missed", points_awarded: null }),
    ];

    const history = await getChallengeHistory();

    expect(history.stats).toEqual({
      completed: 2,
      missed: 1,
      open: 1,
      points: 50,
    });
    expect(history.total).toBe(4);
  });

  it("comptent les points accordés, pas la valeur actuelle du catalogue", async () => {
    // Un défi reprisé en cours d'édition ne doit pas changer un total que
    // quelqu'un a déjà vu.
    state.rows = [
      row({
        status: "completed",
        points_awarded: 20,
        challenges: {
          title: "Cinq bornes",
          description: "",
          evaluator: "distance",
          config: {},
          points: 999,
        },
      }),
    ];

    expect((await getChallengeHistory()).stats.points).toBe(20);
  });

  it("portent sur toute l’édition, pas sur la page affichée", async () => {
    // Un total qui changerait en tournant la page serait pire que pas de
    // total du tout.
    state.rows = Array.from({ length: 25 }, (_, index) =>
      row({ id: `a-${index}`, status: "completed", points_awarded: 10 }),
    );

    const history = await getChallengeHistory(2);

    expect(history.stats.points).toBe(250);
    expect(history.items.length).toBeLessThanOrEqual(HISTORY_PAGE_SIZE);
  });

  it("valent zéro sans aucun défi", async () => {
    const history = await getChallengeHistory();

    expect(history.total).toBe(0);
    expect(history.stats.points).toBe(0);
    expect(history.pageCount).toBe(1);
  });
});

describe("la pagination", () => {
  beforeEach(() => {
    state.rows = Array.from({ length: 45 }, (_, index) =>
      row({ id: `a-${index}` }),
    );
  });

  it("découpe en pages", async () => {
    const history = await getChallengeHistory(1);

    expect(history.pageCount).toBe(3);
    expect(state.range).toEqual({ from: 0, to: HISTORY_PAGE_SIZE - 1 });
  });

  it("demande la bonne tranche", async () => {
    await getChallengeHistory(3);

    expect(state.range).toEqual({ from: 40, to: 59 });
  });

  it("ramène une page hors bornes dans les bornes", async () => {
    // Un lien resté dans l'historique d'un navigateur doit montrer la
    // dernière page, pas une erreur.
    expect((await getChallengeHistory(99)).page).toBe(3);
    expect((await getChallengeHistory(0)).page).toBe(1);
    expect((await getChallengeHistory(-4)).page).toBe(1);
  });

  it("ne fait rien pour un visiteur sans session", async () => {
    state.user = null;

    const history = await getChallengeHistory();

    expect(history.total).toBe(0);
    expect(state.range).toBe(null);
  });
});

describe("l’écran d’historique", () => {
  const page = code("src/app/(participant)/jeu/historique/page.tsx");

  it("passe par la session du participant, pas par la clé de service", () => {
    // C'est la sécurité au niveau des lignes qui garantit qu'on ne lit pas
    // l'historique d'un autre.
    expect(code("src/lib/challenges/assignments.ts")).not.toMatch(
      /createAdminClient/,
    );
  });

  it("affiche les points, les réussis et ce qui reste jouable", () => {
    expect(page).toMatch(/Points/);
    expect(page).toMatch(/Défis réussis/);
    expect(page).toMatch(/Encore jouables/);
  });

  it("date chaque défi en toutes lettres", () => {
    expect(page).toMatch(/weekday: "long"/);
  });

  it("construit la date à midi, comme partout ailleurs", () => {
    // Pour qu'un changement d'heure ne décale pas le jour affiché.
    expect(page).toMatch(/Date\.UTC\([\s\S]{0,80}12\)/);
  });

  it("dit qu’un défi non validé reste jouable", () => {
    expect(page).toMatch(/reste ouvert/);
  });

  it("ne montre la pagination que lorsqu’elle sert", () => {
    expect(page).toMatch(/history\.pageCount > 1/);
  });
});
