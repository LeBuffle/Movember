import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { findAdminSection } from "@/lib/admin/sections";
import {
  CATALOGUE_MINIMUM,
  CATALOGUE_TARGET,
  catalogueHealth,
  escapeLikePattern,
  hasActiveFilters,
  parseCatalogueFilters,
} from "@/lib/challenges/catalogue";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const actions = code("src/lib/challenges/admin-actions.ts");

describe("l’alerte sur la taille du catalogue", () => {
  it("compte trente jours, pas un de moins", () => {
    // Novembre dure trente jours, personne ne reçoit deux fois le même défi
    // tiré au sort : en dessous de trente défis actifs, la tâche quotidienne
    // tombe en panne sèche à une date que personne ne peut prévoir en
    // regardant l'écran. Le seuil est arithmétique, pas éditorial.
    expect(CATALOGUE_MINIMUM).toBe(30);
  });

  it.each([
    [0, "danger"],
    [29, "danger"],
    [30, "warning"],
    [59, "warning"],
    [60, "success"],
    [80, "success"],
  ])("passe de %i défis à un ton « %s »", (active, tone) => {
    expect(catalogueHealth(active).tone).toBe(tone);
  });

  it("dit combien il en manque, pas seulement qu’il en manque", () => {
    const health = catalogueHealth(12);

    expect(health.message).toMatch(/18/);
    expect(health.title).toMatch(/12/);
  });

  it("ne se contente pas du minimum", () => {
    // À trente pile, tout le monde reçoit les mêmes trente défis et en
    // retirer un casse le mois. La cible reste 60 à 80.
    expect(CATALOGUE_TARGET).toBe(60);
    expect(catalogueHealth(30).message).toMatch(/60/);
  });
});

describe("les filtres du catalogue", () => {
  it("montre les défis en jeu par défaut", () => {
    const filters = parseCatalogueFilters({});

    expect(filters.status).toBe("active");
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("ignore une valeur inventée plutôt que de ne rien afficher", () => {
    // Une adresse bricolée ou un lien vieilli ne doit pas donner une liste
    // vide qui ressemble à un catalogue perdu.
    const filters = parseCatalogueFilters({
      sport: "equitation",
      difficulte: "impossible",
      type: "téléportation",
      etat: "peut-être",
    });

    expect(filters.sport).toBe(null);
    expect(filters.difficulty).toBe(null);
    expect(filters.evaluator).toBe(null);
    expect(filters.status).toBe("active");
  });

  it("retient les valeurs connues", () => {
    const filters = parseCatalogueFilters({
      q: "  café  ",
      sport: "run",
      difficulte: "facile",
      type: "distance",
      etat: "all",
    });

    expect(filters).toEqual({
      search: "café",
      sport: "run",
      difficulty: "facile",
      evaluator: "distance",
      status: "all",
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("borne la recherche", () => {
    expect(parseCatalogueFilters({ q: "a".repeat(500) }).search).toHaveLength(
      80,
    );
  });

  it("prend la première valeur d’un paramètre répété", () => {
    expect(parseCatalogueFilters({ sport: ["run", "bike"] }).sport).toBe("run");
  });

  it("neutralise les caractères de motif", () => {
    // Sans cela, taper « % » remonte tout le catalogue et se raconte ensuite
    // comme « la recherche ne marche pas ».
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });
});

describe("l’écriture dans le catalogue", () => {
  it("passe par la session de l’administrateur, jamais par la clé de service", () => {
    // La clé de service contourne entièrement la sécurité au niveau des
    // lignes. L'utiliser ici ferait de ce fichier la seule protection du
    // catalogue — et une protection qui tient à ce qu'un fichier pense à
    // vérifier n'en est pas une.
    expect(actions).not.toMatch(/supabase\/admin/);
    expect(actions).not.toMatch(/createAdminClient/);
    expect(actions).toMatch(/from "@\/lib\/supabase\/server"/);
  });

  it("vérifie le rôle avant toute écriture", () => {
    const guards = actions.match(/requireAdmin\(\)/g) ?? [];

    // Une par action exportée : enregistrer, et changer l'état.
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it("journalise chaque geste", () => {
    // Un catalogue édité à plusieurs, depuis trois téléphones, en septembre,
    // doit pouvoir répondre en décembre à « qui a changé ce défi ».
    for (const action of [
      "challenge.created",
      "challenge.updated",
      "challenge.deactivated",
      "challenge.reactivated",
    ]) {
      expect(actions).toContain(action);
    }
  });

  it("ne supprime jamais un défi", () => {
    // Une suppression emporterait les attributions et les résultats qui le
    // référencent — la base refuse d'ailleurs (`on delete restrict`). Le
    // retrait du tirage est un drapeau, pas un effacement.
    expect(actions).not.toMatch(/\.delete\(/);
    expect(actions).toMatch(/is_active/);
  });

  it("n’écrit aucune donnée personnelle dans le journal", () => {
    // Une entrée de journal survit au compte qu'elle mentionne. Elle porte
    // l'identifiant du défi et son titre, jamais quelqu'un.
    const payloads = actions.match(/payload:\s*\{[\s\S]*?\}/g) ?? [];

    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(payload).not.toMatch(/email|display_name|profile/i);
    }
  });
});

describe("la section du back-office", () => {
  it("n’annonce plus un écran à venir", () => {
    expect(findAdminSection("defis")?.status).toBe("available");
  });
});
