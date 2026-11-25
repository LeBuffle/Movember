import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  drawCard,
  drawPack,
  type DrawableCard,
  type RarityWeight,
} from "@/lib/cards/draw";

const root = path.resolve(import.meta.dirname, "../..");

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260806130000_cards.sql"),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Ce qui transforme un suivi sportif en jeu
 *
 * La récompense immédiate et la collection sont le moteur de rétention sur
 * trente jours. Et les probabilités sont la seule chose ici que personne ne
 * peut vérifier en regardant l'écran — d'où un test statistique.
 * ====================================================================== */

const WEIGHTS: RarityWeight[] = [
  { slug: "commune", weight: 60 },
  { slug: "rare", weight: 28 },
  { slug: "epique", weight: 10 },
  { slug: "legendaire", weight: 2 },
];

const CATALOGUE: DrawableCard[] = [
  { id: "c1", rarity: "commune" },
  { id: "c2", rarity: "commune" },
  { id: "r1", rarity: "rare" },
  { id: "r2", rarity: "rare" },
  { id: "e1", rarity: "epique" },
  { id: "l1", rarity: "legendaire" },
];

/** Déterministe : un test qui passe le mardi et échoue le mercredi ne vaut rien. */
function sequence(seed: number): () => number {
  let state = seed;

  return () => {
    // Générateur congruentiel simple. Reproductible, et c'est tout ce qu'on
    // lui demande.
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("le schéma des cartes", () => {
  it("porte les poids en base, pas dans le code", () => {
    // Une légendaire trop rare démobilise, trop commune ne vaut rien — et on
    // ne le saura qu'en observant novembre.
    expect(migration).toMatch(/create table public\.card_rarities/);
    expect(migration).toMatch(/weight integer not null/);
  });

  it("distingue les sources qui comptent au classement", () => {
    // C'est cette colonne, à elle seule, qui empêche d'acheter sa place.
    expect(migration).toMatch(
      /source in \('challenge', 'daily_draw', 'pack', 'purchase', 'manual'\)/,
    );
  });

  it("interdit deux cartes pour un même défi", () => {
    // Une évaluation rejouée, deux activités arrivant ensemble : chacun de ces
    // cas passerait un contrôle applicatif.
    expect(migration).toMatch(
      /unique index card_grants_one_per_assignment[\s\S]*?\(assignment_id\)/,
    );
  });

  it("empêche de supprimer une carte déjà distribuée", () => {
    expect(migration).toMatch(/card_id[\s\S]{0,80}on delete restrict/);
  });

  it("garde les cartes non publiées invisibles", () => {
    // Une carte que personne n'a encore vue est une surprise.
    expect(migration).toMatch(/using \(published_at is not null\)/);
  });

  it("n’ouvre aucune écriture sur les attributions", () => {
    // Quelqu'un capable d'insérer s'offrirait la légendaire.
    const grants = migration.slice(migration.indexOf("card_grants for select"));

    expect(grants).not.toMatch(/card_grants for (insert|update|delete|all)/);
  });

  it("protège les trois tables", () => {
    for (const table of ["card_rarities", "cards", "card_grants"]) {
      expect(migration).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });
});

describe("les probabilités annoncées sont celles obtenues", () => {
  it("respecte les poids sur dix mille tirages", () => {
    const random = sequence(42);
    const counts: Record<string, number> = {};
    const runs = 10_000;

    for (let index = 0; index < runs; index += 1) {
      const card = drawCard({
        cards: CATALOGUE,
        weights: WEIGHTS,
        owned: new Set(),
        roll: random(),
        pick: random(),
      });

      counts[card!.rarity] = (counts[card!.rarity] ?? 0) + 1;
    }

    // Deux points de tolérance : au-delà, ce n'est plus du bruit.
    expect(counts.commune! / runs).toBeCloseTo(0.6, 1);
    expect(counts.rare! / runs).toBeCloseTo(0.28, 1);
    expect(counts.epique! / runs).toBeCloseTo(0.1, 1);
    expect(counts.legendaire! / runs).toBeGreaterThan(0.005);
    expect(counts.legendaire! / runs).toBeLessThan(0.04);
  });

  it("rend la légendaire atteignable sans payer", () => {
    // Une rareté strictement payante contredirait « aucun avantage acheté ».
    const random = sequence(7);
    let found = false;

    for (let index = 0; index < 2000 && !found; index += 1) {
      const card = drawCard({
        cards: CATALOGUE,
        weights: WEIGHTS,
        owned: new Set(),
        roll: random(),
        pick: random(),
      });

      found = card?.rarity === "legendaire";
    }

    expect(found).toBe(true);
  });

  it("ne fausse pas les chances quand une rareté est vide", () => {
    // Tirer puis se rabattre rendrait les communes plus probables que ce que
    // les poids annoncent. On écarte les raretés vides AVANT de tirer.
    const sansEpique = CATALOGUE.filter((card) => card.rarity !== "epique");
    const random = sequence(11);
    const counts: Record<string, number> = {};
    const runs = 6000;

    for (let index = 0; index < runs; index += 1) {
      const card = drawCard({
        cards: sansEpique,
        weights: WEIGHTS,
        owned: new Set(),
        roll: random(),
        pick: random(),
      });

      counts[card!.rarity] = (counts[card!.rarity] ?? 0) + 1;
    }

    expect(counts.epique).toBeUndefined();
    // 60 / 90 des poids restants, et non 60 / 100.
    expect(counts.commune! / runs).toBeCloseTo(60 / 90, 1);
  });
});

describe("le choix de la carte dans sa rareté", () => {
  it("préfère une carte que le participant n’a pas", () => {
    const card = drawCard({
      cards: CATALOGUE,
      weights: [{ slug: "commune", weight: 1 }],
      owned: new Set(["c1"]),
      roll: 0,
      pick: 0,
    });

    expect(card?.id).toBe("c2");
  });

  it("ne refuse pas de donner quand tout est déjà possédé", () => {
    // Une collection complète ne doit pas cesser de produire des cartes.
    const card = drawCard({
      cards: CATALOGUE,
      weights: [{ slug: "commune", weight: 1 }],
      owned: new Set(["c1", "c2"]),
      roll: 0,
      pick: 0.9,
    });

    expect(card).not.toBe(null);
    expect(["c1", "c2"]).toContain(card!.id);
  });

  it("ne tombe pas à côté sur une valeur extrême", () => {
    // Un tirage à exactement 1 passerait au-delà de la dernière tranche.
    for (const roll of [0, 0.999999, 1]) {
      expect(
        drawCard({
          cards: CATALOGUE,
          weights: WEIGHTS,
          owned: new Set(),
          roll,
          pick: 1,
        }),
      ).not.toBe(null);
    }
  });

  it("rend null sur un catalogue vide plutôt que d’échouer", () => {
    // En septembre le catalogue est vide, et un défi validé alors ne doit pas
    // tomber en erreur pour autant.
    expect(
      drawCard({
        cards: [],
        weights: WEIGHTS,
        owned: new Set(),
        roll: 0.5,
        pick: 0.5,
      }),
    ).toBe(null);
  });
});

describe("les packs", () => {
  const rolls = Array.from(
    { length: 20 },
    (_, index) => ((index * 37) % 100) / 100,
  );

  it("contiennent cinq cartes", () => {
    expect(
      drawPack({
        cards: CATALOGUE,
        weights: WEIGHTS,
        owned: new Set(),
        rolls,
        guaranteed: "legendaire",
      }),
    ).toHaveLength(5);
  });

  it("garantissent la rareté promise", () => {
    const pack = drawPack({
      cards: CATALOGUE,
      weights: WEIGHTS,
      owned: new Set(),
      rolls,
      guaranteed: "legendaire",
    });

    expect(pack.some((card) => card.rarity === "legendaire")).toBe(true);
  });

  it("laissent les quatre autres cartes au tirage normal", () => {
    // La garantie est un plancher, pas un plafond : forcer le reste en
    // commune ferait de la garantie un lot de consolation.
    const pack = drawPack({
      cards: CATALOGUE,
      weights: WEIGHTS,
      owned: new Set(),
      rolls,
      guaranteed: "commune",
    });

    expect(new Set(pack.map((card) => card.rarity)).size).toBeGreaterThan(1);
  });

  it("donnent cinq cartes même sans carte de la rareté garantie", () => {
    const pack = drawPack({
      cards: CATALOGUE.filter((card) => card.rarity !== "legendaire"),
      weights: WEIGHTS,
      owned: new Set(),
      rolls,
      guaranteed: "legendaire",
    });

    expect(pack).toHaveLength(5);
  });
});
