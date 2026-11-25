import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  drawPack,
  type DrawableCard,
  type RarityWeight,
} from "@/lib/cards/draw";

/* =========================================================================
 * Packs achetables (epic 10)
 *
 * **Rien de ce qui s'achète ici ne fait gagner une place** (PRD D2, FR72).
 * C'est la seule raison pour laquelle une boutique peut exister dans ce jeu
 * sans le transformer en pay-to-win, et c'est le critère de sortie de l'epic
 * qui doit être vérifié par un test automatisé.
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
  read("supabase/migrations/20260806270000_card_packs.sql"),
);
const leaderboards = code(
  read("supabase/migrations/20260806250000_participant_suspension.sql"),
);
const grant = code(read("src/lib/packs/grant.ts"));
const purchase = code(read("src/lib/packs/purchase.ts"));
const actions = code(read("src/lib/packs/actions.ts"));
const checkout = code(read("src/lib/packs/checkout.ts"));
const activation = code(read("src/lib/registration/activation.ts"));
const shop = code(read("src/app/(participant)/jeu/boutique/page.tsx"));
const breakdown = code(read("src/lib/accounting/breakdown.ts"));
const exporter = code(read("src/lib/accounting/export.ts"));

const WEIGHTS: RarityWeight[] = [
  { slug: "commune", weight: 60 },
  { slug: "rare", weight: 28 },
  { slug: "epique", weight: 10 },
  { slug: "legendaire", weight: 2 },
];

function catalogue(): DrawableCard[] {
  return [
    { id: "c1", rarity: "commune" },
    { id: "c2", rarity: "commune" },
    { id: "c3", rarity: "rare" },
    { id: "c4", rarity: "epique" },
    { id: "c5", rarity: "legendaire" },
    { id: "c6", rarity: "rare" },
  ];
}

describe("acheter n’améliore jamais un classement", () => {
  it("les cartes achetées portent une source à part", () => {
    // Cette colonne porte à elle seule l'intégrité du classement collection.
    expect(grant).toMatch(/source: "purchase"/);
  });

  it("et le classement ne compte que ce qui a été gagné", () => {
    // Vérifié au niveau de la vue matérialisée, pas de l'application : un
    // filtre applicatif oublié une fois viderait la règle de son sens.
    expect(leaderboards).toMatch(/source in \('challenge', 'daily_draw'\)/);
    expect(leaderboards).not.toMatch(/source in \([^)]*'purchase'/);
  });

  it("la boutique le dit avant d’afficher un prix", () => {
    // Une règle enterrée sous un bouton est une règle qui vend un
    // malentendu.
    const rule = shop.indexOf("ne comptent jamais dans le classement");
    const price = shop.indexOf("formatEuros(pack.priceCents)");

    expect(rule).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(price);
  });
});

describe("la composition d’un pack", () => {
  it("rend le nombre de cartes annoncé", () => {
    const drawn = drawPack({
      cards: catalogue(),
      weights: WEIGHTS,
      owned: new Set(),
      rolls: Array.from({ length: 12 }, (_, index) => (index % 10) / 10),
      guaranteed: "epique",
      size: 5,
    });

    expect(drawn).toHaveLength(5);
  });

  it("respecte la garantie annoncée", () => {
    const drawn = drawPack({
      cards: catalogue(),
      weights: WEIGHTS,
      owned: new Set(),
      // Que des tirages bas : sans la garantie, tout serait commun.
      rolls: Array.from({ length: 12 }, () => 0),
      guaranteed: "legendaire",
      size: 5,
    });

    expect(drawn.some((card) => card.rarity === "legendaire")).toBe(true);
  });

  it("accepte un pack sans garantie", () => {
    // C'est un pack légitime, et le moins cher.
    const drawn = drawPack({
      cards: catalogue(),
      weights: WEIGHTS,
      owned: new Set(),
      rolls: Array.from({ length: 12 }, () => 0.5),
      guaranteed: null,
      size: 5,
    });

    expect(drawn).toHaveLength(5);
  });

  it("la garantie est un plancher, pas un plafond", () => {
    // Forcer le reste en commune ferait de la garantie un lot de
    // consolation.
    const drawn = drawPack({
      cards: [
        { id: "l1", rarity: "legendaire" },
        { id: "l2", rarity: "legendaire" },
      ],
      weights: [{ slug: "legendaire", weight: 2 }],
      owned: new Set(),
      rolls: Array.from({ length: 12 }, () => 0.5),
      guaranteed: "legendaire",
      size: 2,
    });

    expect(drawn.filter((card) => card.rarity === "legendaire")).toHaveLength(
      2,
    );
  });

  it("elle est figée à l’achat, pas relue au moment de la remise", () => {
    // Un pack vendu le 5 novembre avec une épique garantie doit livrer une
    // épique, même s'il est remanié le 10 (architecture D12).
    expect(migration).toMatch(/create table public\.pack_purchases/);
    expect(migration).toMatch(/card_count integer not null/);
    expect(actions).toMatch(/card_count: pack\.cardCount/);
    expect(actions).toMatch(/guaranteed_rarity: pack\.guaranteedRarity/);
  });
});

describe("le paiement d’un pack", () => {
  it("ne laisse jamais le navigateur décider du montant", () => {
    expect(checkout).toMatch(/unit_amount: pack\.priceCents/);
    expect(checkout).not.toMatch(/formData/);
  });

  it("l’achat est créé avant d’envoyer chez Stripe", () => {
    // Sans cette ligne, quelqu'un qui paye et ne revient jamais ne laisse
    // rien à quoi répondre « j'ai payé et je n'ai rien reçu ».
    // L'appel, pas l'import — qui vient forcément en premier.
    const body = actions.slice(
      actions.indexOf("export async function buyPack"),
    );

    expect(body.indexOf('.from("pack_purchases")')).toBeLessThan(
      body.indexOf("await createPackCheckoutSession"),
    );
    expect(actions).toMatch(/status: "pending"/);
  });

  it("et il est réservé aux inscrits actifs", () => {
    // Vendre des cartes à qui n'est pas inscrit rendrait l'album accessible
    // sans jouer, et créerait un paiement sans inscription à rembourser.
    expect(actions).toMatch(/registration\?\.status !== "active"/);
  });

  it("seul le webhook remet les cartes", () => {
    // Le retour depuis Stripe ne prouve rien : c'est un navigateur qui le
    // déclenche.
    expect(shop).not.toMatch(/grantPurchasedPack/);
    expect(purchase).toMatch(/grantPurchasedPack/);
  });

  it("routé sur le type écrit par nous, jamais deviné du montant", () => {
    // Deux produits peuvent parfaitement coûter le même prix.
    expect(checkout).toMatch(/kind: "pack"/);
    expect(activation).toMatch(/kind === "pack"/);
  });

  it("il passe par la même porte que l’inscription", () => {
    // Ce qui lui fait hériter du rattrapage de la story 9.5 : un paiement de
    // pack perdu est repêché exactement comme un paiement d'inscription.
    expect(activation).toMatch(/return handlePackPurchase\(session\)/);
  });
});

describe("un webhook rejoué ne double rien", () => {
  it("les cartes ne sont remises qu’une fois", () => {
    // La garde est un comptage des lignes déjà rattachées à cet achat,
    // demandé à la base et pas retenu dans l'application.
    expect(grant).toMatch(/\.eq\("pack_purchase_id", purchase\.id\)/);
    expect(grant).toMatch(/alreadyDone: true/);
  });

  it("la ligne comptable est refusée par la base, pas par un « si »", () => {
    expect(purchase).toMatch(/UNIQUE_VIOLATION/);
    expect(migration).toMatch(/pack_purchases_session_unique unique/);
  });

  it("le passage à « payé » porte sa garde dans l’écriture", () => {
    expect(purchase).toMatch(/\.eq\("status", "pending"\)/);
  });

  it("et les cartes sont tirées à chaque passage, pas seulement au premier", () => {
    // Une première livraison morte entre le solde et le tirage laisserait
    // sinon quelqu'un payé, soldé et les mains vides.
    const body = purchase.slice(
      purchase.indexOf("export async function handlePackPurchase"),
    );

    expect(body.indexOf('.eq("status", "pending")')).toBeLessThan(
      body.indexOf("await grantPurchasedPack"),
    );
  });

  it("un échec de lecture demande à Stripe de revenir", () => {
    // Répondre 200 ferait classer l'affaire : argent pris, pas de cartes.
    expect(purchase).toMatch(/ok: false, reason: "purchase-unreadable"/);
  });
});

describe("personne n’écrit son propre achat", () => {
  it("aucune politique d’écriture sur les achats", () => {
    // La sécurité au niveau des lignes filtre des LIGNES, pas des COLONNES :
    // qui pourrait écrire sa ligne pourrait écrire `status`.
    const section = migration.slice(
      migration.indexOf(
        'create policy "participants read their own purchases"',
      ),
    );

    expect(section).not.toMatch(
      /pack_purchases for (insert|update|all|delete)/,
    );
  });

  it("la boutique n’est pas lisible par un visiteur anonyme", () => {
    const section = migration.slice(
      migration.indexOf('create policy "participants read the packs on sale"'),
      migration.indexOf(
        'create policy "participants read their own purchases"',
      ),
    );

    expect(section).not.toMatch(/to anon/);
  });

  it("un pack acheté ne peut plus être supprimé", () => {
    expect(migration).toMatch(
      /pack_id uuid not null references public\.card_packs \(id\) on delete restrict/,
    );
  });
});

describe("le revenu des packs est reversé en entier", () => {
  it("la base l’impose, la page ne fait que le dire", () => {
    expect(migration).toMatch(
      /card_packs_fully_donated check \(donated_cents = price_cents\)/,
    );
  });

  it("la ligne comptable engage la totalité", () => {
    expect(purchase).toMatch(/donation_cents: grossCents/);
    expect(purchase).toMatch(/counterpart_cents: 0/);
  });

  it("et il apparaît distinct des inscriptions", () => {
    // Sans sa propre ligne, chaque pack vendu tomberait dans « sans niveau
    // rattaché » — la ligne qui veut dire « quelque chose ne va pas ».
    expect(breakdown).toMatch(/row\.kind === "pack"/);
    expect(breakdown).toMatch(/packs\.grossCents/);
    expect(exporter).toMatch(/pack: "Pack"/);
  });
});
