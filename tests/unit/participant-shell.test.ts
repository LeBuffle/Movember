import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { activeTab } from "@/components/layout/participant-tabs";

/* =========================================================================
 * La coquille de l'espace participant (story 1.12)
 *
 * Six écrans existaient sans aucun moyen de passer de l'un à l'autre.
 * Chacun fonctionnait ; l'ensemble ne faisait pas une application. Le PO
 * l'a dit à la première utilisation : « ça fait pas vraiment des menus ».
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const tabs = code(read("src/components/layout/participant-tabs.tsx"));
const shell = code(read("src/components/layout/participant-shell.tsx"));
const header = code(read("src/components/layout/site-header.tsx"));
const account = code(read("src/app/(participant)/mon-compte/page.tsx"));

const SCREENS = [
  "src/app/(participant)/jeu/page.tsx",
  "src/app/(participant)/jeu/collection/page.tsx",
  "src/app/(participant)/jeu/collection/reveler/page.tsx",
  "src/app/(participant)/jeu/collection/[carte]/page.tsx",
  "src/app/(participant)/jeu/classement/page.tsx",
  "src/app/(participant)/jeu/equipe/page.tsx",
  "src/app/(participant)/jeu/equipe/[slug]/page.tsx",
  "src/app/(participant)/jeu/tableau-de-bord/page.tsx",
  "src/app/(participant)/jeu/actualites/page.tsx",
  "src/app/(participant)/jeu/historique/page.tsx",
  "src/app/(participant)/mon-compte/page.tsx",
  "src/app/(participant)/mon-compte/activites/page.tsx",
  "src/app/(participant)/mon-compte/notifications/page.tsx",
  "src/app/(participant)/mon-compte/adresse/page.tsx",
];

describe("chaque écran participant porte la coquille", () => {
  it.each(SCREENS)("%s", (screen) => {
    // Un écran qui l'oublie perd la barre d'onglets : le participant y entre
    // et ne peut plus en sortir autrement qu'avec le bouton « précédent ».
    expect(code(read(screen))).toMatch(/<ParticipantShell/);
  });

  it("et aucun ne réutilise l'en-tête public", () => {
    for (const screen of SCREENS) {
      expect(code(read(screen))).not.toMatch(/<SiteHeader/);
    }
  });
});

describe("la barre d'onglets", () => {
  it("porte cinq onglets, pas six", () => {
    // Au-delà de cinq, chaque cible devient trop étroite pour un pouce sur un
    // écran de 375 px.
    expect(tabs.match(/href: "/g)).toHaveLength(5);
  });

  it("mène aux quatre piliers du jeu et au compte", () => {
    for (const href of [
      "/jeu",
      "/jeu/collection",
      "/jeu/classement",
      "/jeu/equipe",
      "/mon-compte",
    ]) {
      expect(tabs).toContain(`href: "${href}"`);
    }
  });

  it("allume l'onglet le plus précis, pas le premier qui correspond", () => {
    // `/jeu` est un préfixe de toutes les routes du jeu : sans la règle du
    // plus long, il resterait allumé partout.
    expect(activeTab("/jeu")).toBe("/jeu");
    expect(activeTab("/jeu/collection")).toBe("/jeu/collection");
    expect(activeTab("/jeu/collection/reveler")).toBe("/jeu/collection");
    expect(activeTab("/jeu/equipe/les-moustachus")).toBe("/jeu/equipe");
    expect(activeTab("/mon-compte/notifications")).toBe("/mon-compte");
  });

  it("n'allume rien sur un écran qui n'est pas un onglet", () => {
    expect(activeTab("/jeu/tableau-de-bord")).toBe("/jeu");
    expect(activeTab("/participer")).toBeNull();
  });

  it("reste au-dessus de la zone de geste de l'iPhone", () => {
    // Sans cette marge, les libellés se posent sous l'indicateur d'accueil,
    // où l'appui est avalé par le système.
    expect(tabs).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it("et le contenu ne passe jamais dessous", () => {
    // Le défaut classique d'une barre flottante : la dernière ligne de la
    // page est masquée et personne ne comprend pourquoi.
    expect(shell).toMatch(/pb-32/);
  });
});

describe("les portes qui manquaient", () => {
  it("le site public mène à la connexion", () => {
    expect(header).toMatch(/Se connecter/);
  });

  it("le compte mène à l'inscription quand elle n'est pas finalisée", () => {
    // C'est exactement là que le premier utilisateur réel s'est retrouvé
    // bloqué : compte créé, connecté, et aucune porte sur la page.
    expect(account).toMatch(/!access\.isActive/);
    expect(account).toMatch(/href="\/participer"/);
  });

  it("et au jeu quand elle l'est", () => {
    expect(account).toMatch(/href="\/jeu"/);
  });

  it("la barre d'onglets disparaît sans inscription active", () => {
    // Sinon quatre onglets sur cinq renvoient vers l'écran d'inscription, ce
    // qui se lit comme une application cassée plutôt que comme une porte.
    expect(account).toMatch(/tabs=\{access\.isActive\}/);
    expect(shell).toMatch(/tabs = true/);
  });
});
