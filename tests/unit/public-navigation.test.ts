import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { entryRouteFor, ROUTES } from "@/lib/auth/routes";
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

describe("le parcours commence par le choix, pas par le compte", () => {
  it("la page d'accueil porte un appel à l'action unique", () => {
    // Personne ne crée un compte pour quelque chose dont il n'a pas vu le
    // prix. Le choix d'abord ; le compte au moment où il devient nécessaire.
    expect(home).toMatch(/Je participe/);
    expect(home).toMatch(/href="#tarifs"/);
  });

  it("et il n'apparaît que s'il y a des formules à choisir", () => {
    // Un bouton menant à une liste vide est pire que pas de bouton. La
    // présence des formules EST le signal d'ouverture — une date écrite ici
    // en plus serait une seconde source de vérité.
    expect(home).toMatch(/tiers\.length > 0 \? \(/);
  });

  it("celui qui a déjà un compte retrouve son chemin depuis l'accueil", () => {
    // Sans quoi il repasse par un écran qui lui demande de s'inscrire.
    const hero = home.slice(0, home.indexOf("Voir les cartes"));

    expect(hero).toMatch(/Déjà inscrit \?/);
    expect(hero).toMatch(/href="\/connexion"/);
  });

  it("choisir une formule sans compte mène à la création, pas à la connexion", () => {
    // Demander un mot de passe jamais choisi est le moment où un tunnel perd
    // des gens.
    expect(entryRouteFor("/participer/chevronne")).toBe(ROUTES.signUp);
    expect(entryRouteFor("/participer")).toBe(ROUTES.signUp);
  });

  it("mais un lien vers le jeu mène bien à la connexion", () => {
    // Y arriver suppose un signet ou une habitude : le compte existe.
    expect(entryRouteFor("/jeu")).toBe(ROUTES.signIn);
    expect(entryRouteFor("/mon-compte/notifications")).toBe(ROUTES.signIn);
  });

  it("et la destination voyage avec le visiteur", () => {
    const middleware = read("src/lib/supabase/middleware.ts");

    expect(middleware).toMatch(/entryRouteFor\(pathname\)/);
    expect(middleware).toMatch(/searchParams\.set\("suite", pathname\)/);
  });

  it("la formule choisie reste nommée pendant la création du compte", () => {
    // Un formulaire qui a oublié ce qu'on vient de choisir se lit comme un
    // formulaire qui l'a perdu.
    const signUp = read("src/app/(public)/inscription/page.tsx");

    expect(signUp).toMatch(/Formule choisie/);
    expect(signUp).toMatch(/\^\\\/participer\\\/\(\[a-z0-9-\]\+\)\$/);
  });
});

describe("l'ouverture des inscriptions", () => {
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

  it("et la phrase « pas encore ouvertes » ne s'affiche qu'en leur absence", () => {
    const closed = home.slice(home.indexOf("tiers.length > 0 ? ("));

    expect(closed).toMatch(/Les inscriptions ne sont pas ouvertes/);
  });
});
