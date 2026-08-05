import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChallengeCard } from "@/components/game/challenge-card";
import type { ParticipantChallenge } from "@/lib/challenges/assignments";
import { challengeProgress } from "@/lib/challenges/progress";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * L'écran que les participants ouvriront tous les jours pendant un mois
 *
 * Il mérite plus d'attention que sa taille ne le suggère.
 * ====================================================================== */

const CHALLENGE: ParticipantChallenge = {
  id: "a-1",
  assignedFor: "2026-11-15",
  status: "open",
  source: "draw",
  title: "Cinq bornes avant le café",
  description: "Une mise en jambes.",
  lines: [
    "Parcourir 5 km dans la journée.",
    "Sports acceptés : course à pied.",
  ],
  points: 20,
  pointsAwarded: null,
  completedAt: null,
  measured: null,
  evaluator: "distance",
  config: { min_distance_meters: 5000, sport_types: ["run"], window: "day" },
  arbitratedAt: null,
};

const render = (
  challenge: Partial<ParticipantChallenge> = {},
  today?: string,
) =>
  renderToStaticMarkup(
    <ChallengeCard challenge={{ ...CHALLENGE, ...challenge }} today={today} />,
  );

describe("la carte d’un défi", () => {
  it("montre le titre, la règle et les points", () => {
    const html = render();

    expect(html).toContain("Cinq bornes avant le café");
    expect(html).toContain("Parcourir 5 km dans la journée.");
    expect(html).toContain("20 points");
  });

  it("dit son état par un mot, pas seulement par une couleur", () => {
    // Un homme sur douze environ distingue mal le rouge du vert. Sur une
    // collecte pour la santé masculine, « vert = réussi » écarterait une part
    // réelle des gens à qui elle s'adresse.
    expect(render({ status: "open" })).toMatch(/À faire|à faire/i);
    expect(render({ status: "completed", measured: 6200 })).toMatch(/Réussi/i);
    expect(render({ status: "missed" })).toMatch(/Manqué/i);
  });

  it("accompagne chaque état d’une forme, pas seulement d’un mot", () => {
    // L'icône est ce qui reste quand l'écran est en noir et blanc, ou quand
    // quelqu'un lit vite.
    for (const status of ["open", "completed", "missed"] as const) {
      expect(render({ status })).toContain("<svg");
    }
  });

  it("annonce l’objectif quand rien n’a encore été mesuré", () => {
    // Plutôt qu'une barre bloquée à zéro : une barre qui n'affiche jamais
    // rien apprend à ne plus la regarder.
    const html = render();

    expect(html).toContain("Objectif : 5 km");
    expect(html).not.toContain("progressbar");
  });

  it("montre la progression dès qu’il y a une mesure", () => {
    const html = render({ status: "completed", measured: 6200 });

    expect(html).toContain("6,2 km");
    expect(html).toContain("progressbar");
  });

  it("dit avec quoi le défi a été validé", () => {
    // « Réussi » tout court appelle le message que tout organisateur
    // redoute : « réussi avec quoi ? »
    expect(render({ status: "completed", measured: 6200 })).toMatch(
      /Validé avec 6,2 km/,
    );
  });

  it("affiche les points gagnés, pas ceux du catalogue, une fois réussi", () => {
    // La valeur d'un défi peut être corrigée en cours d'édition ; ce qui est
    // gagné ne bouge pas.
    const html = render({
      status: "completed",
      measured: 6200,
      points: 50,
      pointsAwarded: 20,
    });

    expect(html).toContain("20 points");
    expect(html).not.toContain("50 points");
  });

  it("tient debout quand les réglages ne sont plus lisibles", () => {
    // Une fiche modifiée en SQL. Le défi s'affiche sans règle inventée.
    const html = render({ config: null, lines: [] });

    expect(html).toContain("Cinq bornes avant le café");
    expect(html).not.toContain("progressbar");
  });

  it("nomme un défi commun pour ce qu’il est", () => {
    // Ça change ce que le défi veut dire : tout le monde l'a aujourd'hui, et
    // c'est tout l'intérêt.
    expect(render({ source: "common" })).toMatch(/Défi commun/);
    expect(render()).not.toMatch(/Défi commun/);
  });

  it("met en avant le défi du jour", () => {
    const highlighted = render({}, "2026-11-15");
    const ordinary = render({}, "2026-11-16");

    expect(highlighted).not.toBe(ordinary);
  });
});

describe("la progression", () => {
  it("parle dans l’unité que le participant a lue", () => {
    // Des mètres et des secondes en base, des kilomètres et des minutes à
    // l'écran — comme dans le formulaire du back-office.
    expect(
      challengeProgress("distance", { min_distance_meters: 5000 }, 3200),
    ).toMatchObject({ target: "5 km", measured: "3,2 km" });

    expect(
      challengeProgress("duration", { min_duration_seconds: 1800 }, 900),
    ).toMatchObject({ target: "30 minutes", measured: "15 minutes" });
  });

  it("compte en jours, en sports et en conditions selon le type", () => {
    expect(challengeProgress("streak", { days: 5 }, null)?.target).toBe(
      "5 jours",
    );
    expect(
      challengeProgress("multisport", { distinct_sports: 3 }, null)?.target,
    ).toBe("3 sports");
    expect(
      challengeProgress("surprise", { conditions: [1, 2] }, null)?.target,
    ).toBe("2 conditions");
  });

  it("suit la donnée cumulée d’un objectif collectif", () => {
    expect(
      challengeProgress(
        "collective",
        { metric: "distance_meters", target: 30_000_000 },
        null,
      )?.target,
    ).toBe("30 000 km");
  });

  it("ne prétend aucune progression sans mesure", () => {
    const progress = challengeProgress(
      "distance",
      { min_distance_meters: 5000 },
      null,
    );

    expect(progress?.measured).toBe(null);
    expect(progress?.ratio).toBe(null);
  });

  it("ne dépasse jamais cent pour cent", () => {
    // Une sortie de 12 km sur un défi de 5 km reste une barre pleine.
    expect(
      challengeProgress("distance", { min_distance_meters: 5000 }, 12000)
        ?.ratio,
    ).toBe(1);
  });

  it("ne descend jamais sous zéro", () => {
    expect(
      challengeProgress("distance", { min_distance_meters: 5000 }, -100)?.ratio,
    ).toBe(0);
  });

  it("se tait quand il n’y a pas d’objectif à montrer", () => {
    expect(challengeProgress("distance", {}, null)).toBe(null);
    expect(challengeProgress("téléportation", { x: 1 }, null)).toBe(null);
  });
});

describe("l’écran de jeu", () => {
  const page = code("src/app/(participant)/jeu/page.tsx");

  it("met le défi du jour en premier", () => {
    // Trier par date seule remonterait un défi d'avant-hier au-dessus de
    // celui du jour, le matin où le tirage passe en retard.
    const todayAt = page.indexOf("todays.length > 0");
    const openAt = page.indexOf("stillOpen.length > 0");
    const settledAt = page.indexOf("settled.length > 0");

    expect(todayAt).toBeGreaterThan(-1);
    expect(openAt).toBeGreaterThan(todayAt);
    expect(settledAt).toBeGreaterThan(openAt);
  });

  it("distingue « le jeu n’a pas commencé » de « le défi manque »", () => {
    // Deux situations très différentes : avant l'ouverture il n'y a rien à
    // craindre ; un défi absent en plein novembre veut dire que quelque
    // chose s'est mal passé, et le participant ne doit pas se demander si
    // c'est de sa faute.
    expect(page).toContain("Le jeu ouvre le 1ᵉʳ novembre");
    expect(page).toContain("Pas de défi pour aujourd’hui");
    expect(page).toMatch(/Ce n’est pas de votre fait/);
  });

  it("dit qu’un défi manqué ne bloque rien", () => {
    expect(page).toMatch(/ne bloque rien/);
  });

  it("prend le jour de Paris, comme le tirage", () => {
    // Sinon l'écran et le tirage ne parleraient pas du même jour.
    expect(page).toMatch(/todayInParis\(\)/);
  });
});
