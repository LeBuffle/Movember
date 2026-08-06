import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REGISTRATION_OPENS_ON,
  registrationsOpen,
} from "@/lib/edition/calendar";

/* =========================================================================
 * Entrer dans l'application depuis le site public
 *
 * Le site n'a longtemps porté aucun lien vers la page de connexion : un
 * participant déjà inscrit ne pouvait revenir qu'en tapant l'adresse. Rien
 * n'était en panne, et c'est pour ça que personne ne l'a vu — sauf la
 * première personne qui a essayé de s'en servir.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

const header = read("src/components/layout/site-header.tsx");
const home = read("src/app/page.tsx");

describe("l'en-tête public", () => {
  it("porte un lien vers la connexion", () => {
    expect(header).toMatch(/ROUTES\.signIn/);
    expect(header).toMatch(/Se connecter/);
  });

  it("ne lit aucune session", () => {
    // Il est rendu sur des pages générées à l'avance — accueil, mentions
    // légales, page 404. Lire la session les rendrait toutes dynamiques.
    expect(header).not.toMatch(/getUser|createClient/);
  });
});

describe("l'ouverture des inscriptions", () => {
  it("est décidée par la date, pas par une phrase écrite en dur", () => {
    // Sans quoi la page continuerait d'annoncer « pas encore ouvertes » le
    // matin du 15 octobre, au-dessus de cartes qui mènent au paiement.
    expect(home).toMatch(/registrationsOpen\(\)/);
    expect(home).not.toMatch(
      /title="Les inscriptions ne sont pas ouvertes">[\s\S]{0,80}Elles ouvriront[\s\S]{0,400}<\/Alert>\s*<\/div>\s*<div className="mt-6/,
    );
  });

  it("bascule bien au jour dit", () => {
    expect(registrationsOpen(new Date("2026-10-14T12:00:00+02:00"))).toBe(
      false,
    );
    expect(registrationsOpen(new Date("2026-10-15T09:00:00+02:00"))).toBe(true);
    expect(registrationsOpen(new Date("2026-11-02T09:00:00+01:00"))).toBe(true);
  });

  it("et la date correspond au calendrier affiché", () => {
    // Deux dates qui divergent, c'est la page qui annonce une ouverture et
    // le bouton qui n'apparaît pas.
    const calendar = read("src/lib/edition/calendar.ts");

    expect(REGISTRATION_OPENS_ON).toBe("2026-10-15");
    expect(calendar).toMatch(/date: "2026-10-15"/);
  });

  it("montre le chemin d'inscription une fois ouvertes", () => {
    expect(home).toMatch(/href="\/participer"/);
  });
});
