import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * La galerie publique (story 5.8)
 *
 * Elle sert la collecte, pas le jeu : son travail est de donner envie de
 * s'inscrire à quelqu'un qui arrive sur le site. Et elle ne doit rien laisser
 * filtrer — ni une collection individuelle, ni un pseudonyme, ni personne.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const gallery = code(read("src/lib/cards/gallery.ts"));
const page = code(read("src/app/(public)/cartes/page.tsx"));
const anon = code(read("src/lib/supabase/anon.ts"));
const home = code(read("src/app/page.tsx"));

describe("aucune donnée personnelle", () => {
  it("la galerie ne lit jamais les attributions", () => {
    // AC 2. Pas « filtrées » : jamais demandées.
    expect(gallery).not.toMatch(/card_grants/);
    expect(gallery).not.toMatch(/profiles/);
    expect(page).not.toMatch(/card_grants/);
  });

  it("elle lit sans session, avec le client anonyme", () => {
    // Ce n'est pas une commodité, c'est la garantie : ce client n'a aucune
    // identité avec laquelle atteindre quoi que ce soit de personnel.
    expect(gallery).toMatch(/createAnonClient/);
    expect(gallery).not.toMatch(/supabase\/server/);
    expect(gallery).not.toMatch(/supabase\/admin/);
  });

  it("le client anonyme ne lit aucun cookie", () => {
    // Une page qui lit un cookie ne peut plus être mise en cache : Next doit
    // supposer que la réponse est personnelle.
    expect(anon).not.toMatch(/cookies/);
    expect(anon).toMatch(/persistSession: false/);
  });

  it("le type renvoyé ne porte aucun champ de participant", () => {
    const type = gallery.slice(
      gallery.indexOf("export type GalleryCard"),
      gallery.indexOf("export type Gallery ="),
    );

    expect(type).not.toMatch(/profile/i);
    expect(type).not.toMatch(/owner/i);
    expect(type).not.toMatch(/copies/i);
  });
});

describe("seules les cartes publiées sont montrées", () => {
  it("la requête l'exige, en plus de la politique", () => {
    // Ceinture et bretelles : une politique assouplie un jour ne doit pas
    // transformer cette page en divulgâcheur.
    expect(gallery).toMatch(/\.not\("published_at", "is", null\)/);
  });
});

describe("elle fonctionne sans compte", () => {
  it("la page ne demande aucune session", () => {
    // AC 4.
    expect(page).not.toMatch(/getUser/);
    expect(page).not.toMatch(/requireAdmin/);
  });

  it("et elle est mise en cache plutôt que recalculée à chaque visite", () => {
    const match = page.match(/export const revalidate = (\d+)/);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
  });
});

describe("elle sert d'argument à l'inscription", () => {
  it("porte un titre et une description pour les moteurs", () => {
    // AC 3. Aucun `robots: { index: false }` ici, contrairement aux écrans du
    // jeu : c'est la seule page cartes qu'on veut voir indexée.
    expect(page).toMatch(/export const metadata/);
    expect(page).toMatch(/description:/);
    expect(page).not.toMatch(/index: false/);
  });

  it("mène à la marche à suivre en bas de page", () => {
    expect(page).toMatch(/Comment participer/);
  });

  it("et l'accueil y mène", () => {
    // Une galerie que personne ne trouve n'attire personne.
    expect(home).toMatch(/href="\/cartes"/);
  });
});

describe("la rareté reste lisible sans la couleur", () => {
  it("chaque carte porte le mot de sa rareté", () => {
    expect(page).toMatch(/RARITY_LABELS\[card\.rarity\]/);
  });

  it("et chaque groupe est titré par son nom", () => {
    expect(page).toMatch(/\{group\.label\}/);
  });
});

describe("le catalogue vide est un cas normal", () => {
  it("la page le dit au lieu de rester blanche", () => {
    // C'est l'état jusqu'en septembre : les visuels sont un chantier PO.
    expect(page).toMatch(/Les cartes arrivent/);
  });

  it("et distingue « vide » de « illisible »", () => {
    expect(gallery).toMatch(/failed/);
    expect(page).toMatch(/gallery\.failed/);
  });
});
