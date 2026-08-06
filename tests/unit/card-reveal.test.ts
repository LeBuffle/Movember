import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Le moment de la découverte (story 5.5)
 *
 * Les défis se valident tout seuls à partir des activités qui remontent —
 * personne n'appuie sur rien. C'est le bon fonctionnement pour le jeu, et
 * cela lui coûte la seule chose dont vit une collection : le moment de
 * l'ouverture. Cet écran est ce qui le rend.
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
  read("supabase/migrations/20260806160000_card_reveal.sql"),
);
const actions = code(read("src/lib/cards/reveal-actions.ts"));
const reveal = code(read("src/lib/cards/reveal.ts"));
const collection = code(read("src/lib/cards/collection.ts"));
const css = read("src/app/globals.css");
const wrapper = code(read("src/components/cards/card-reveal.tsx"));
const detail = code(read("src/components/cards/card-detail.tsx"));
const page = code(
  read("src/app/(participant)/jeu/collection/reveler/page.tsx"),
);
const cardPage = code(
  read("src/app/(participant)/jeu/collection/[carte]/page.tsx"),
);

describe("la file d'attente des cartes à découvrir", () => {
  it("est portée par une colonne, pas par un cookie", () => {
    // Un participant change de téléphone en cours de mois ; la découverte
    // doit le suivre.
    expect(migration).toMatch(/add column revealed_at timestamptz/);
  });

  it("est indexée sur ce qui reste à ouvrir, pas sur tout l'historique", () => {
    expect(migration).toMatch(/create index card_grants_pending_reveal_idx/);
    expect(migration).toMatch(/where revealed_at is null/);
  });

  it("considère comme vues les cartes distribuées avant elle", () => {
    // Sinon un participant revient sur une file contenant tout ce qu'il
    // possède — l'exact contraire d'un moment de découverte.
    expect(migration).toMatch(
      /update public\.card_grants[\s\S]*?set revealed_at = granted_at/,
    );
  });

  it("n'ouvre aucune politique d'écriture sur les attributions", () => {
    // La sécurité au niveau des lignes filtre des LIGNES, pas des COLONNES :
    // qui pourrait écrire revealed_at pourrait écrire source, et transformer
    // une carte de pack en carte gagnée.
    expect(migration).not.toMatch(/create policy/i);
  });
});

describe("marquer une carte comme vue", () => {
  it("passe par la clé de service, faute de politique d'écriture", () => {
    expect(actions).toMatch(/createAdminClient/);
  });

  it("porte la vérification d'identité dans l'écriture elle-même", () => {
    // Un identifiant d'attribution appartenant à quelqu'un d'autre ne change
    // rien.
    expect(actions).toMatch(/\.eq\("profile_id", user\.id\)/);
    expect(actions).toMatch(/\.is\("revealed_at", null\)/);
  });

  it("n'écrit que cette colonne", () => {
    const update = actions.slice(actions.indexOf(".update("));
    const region = update.slice(0, update.indexOf(")"));

    expect(region).toMatch(/revealed_at/);
    expect(region).not.toMatch(/source/);
    expect(region).not.toMatch(/card_id/);
    expect(region).not.toMatch(/profile_id/);
  });

  it("refuse sans session", () => {
    expect(actions).toMatch(/if \(!user\)/);
  });
});

describe("l'album ne montre que ce qui a été ouvert", () => {
  it("filtre les attributions non révélées", () => {
    // Une carte visible dans l'album avant sa révélation gâcherait le seul
    // moment pour lequel la révélation existe.
    expect(collection).toMatch(/\.not\("revealed_at", "is", null\)/);
  });

  it("et l'écran le dit, pour que personne ne cherche sa carte", () => {
    const album = code(read("src/app/(participant)/jeu/collection/page.tsx"));

    expect(album).toMatch(/à découvrir/);
    expect(album).toMatch(/reveler/);
  });
});

describe("l'animation", () => {
  it("existe et se termine sur l'état final", () => {
    // `both` : la dernière image-clé est aussi l'état de repos. La page finit
    // sur la carte révélée, que l'animation ait joué, ait été passée, ou
    // n'ait jamais démarré.
    expect(css).toMatch(/@keyframes carte-revelation/);
    expect(css).toMatch(/\.carte-revelation \{[\s\S]*?both;/);
  });

  it("est courte", () => {
    // Une animation qu'on ne peut pas passer devient une corvée au troisième
    // jour ; une qu'on peut passer mais qui traîne apprend à la passer.
    const match = css.match(/animation: carte-revelation (\d+)ms/);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(1000);
  });

  it("s'interrompt à la première interaction", () => {
    // AC 2. Sur un téléphone, le réflexe est de toucher l'écran — un bouton
    // « passer » se trouverait à la quatrième carte, pas à la première.
    expect(css).toMatch(
      /\.carte-revelation\[data-vue="oui"\][\s\S]*?animation: none/,
    );
    expect(wrapper).toMatch(/pointerdown/);
    expect(wrapper).toMatch(/keydown/);
  });

  it("respecte prefers-reduced-motion", () => {
    // AC 5. Troubles vestibulaires, migraine, mal des transports : la carte
    // apparaît, simplement.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.carte-revelation[\s\S]*?animation: none/,
    );
  });
});

describe("rien ne dépend de JavaScript", () => {
  it("la carte est rendue par le serveur, l'animation est posée par-dessus", () => {
    // AC 6. Le composant client enveloppe du HTML déjà complet ; il ne décide
    // jamais de ce qui est affiché.
    expect(page).toMatch(/<CardReveal>[\s\S]*?<CardDetail/);
    expect(wrapper).toMatch(/children/);
  });

  it("la fiche d'une carte n'a aucun composant client", () => {
    expect(cardPage).not.toMatch(/"use client"/);
    expect(cardPage).toMatch(/getOwnedCard/);
  });

  it("la mise de côté est un formulaire vers une action serveur", () => {
    const continueForm = code(read("src/components/cards/reveal-continue.tsx"));

    expect(continueForm).toMatch(/<form action=\{formAction\}/);
    expect(continueForm).toMatch(/type="hidden" name="grantId"/);
  });
});

describe("la rareté est lisible sans la couleur", () => {
  it("le mot accompagne toujours la teinte", () => {
    // AC 3. Un homme sur douze environ a une déficience de la vision des
    // couleurs, et c'est une collecte pour la santé masculine.
    expect(detail).toMatch(/RARITY_LABELS\[card\.rarity\]/);
  });

  it("et les teintes de repli se distinguent aussi en niveaux de gris", () => {
    expect(detail).toMatch(/RARITY_FILL/);
  });
});

describe("le détail d'une carte", () => {
  it("montre visuel, titre, rareté et date d'obtention", () => {
    // AC 4.
    expect(detail).toMatch(/card\.imagePath/);
    expect(detail).toMatch(/card\.title/);
    expect(detail).toMatch(/RARITY_LABELS/);
    expect(detail).toMatch(/Obtenue le/);
  });

  it("dit sur la carte elle-même si elle compte au classement", () => {
    // Une carte de pack enrichit une collection et n'améliore jamais un score
    // (architecture D8) — et l'endroit où on cherche la réponse, c'est ici.
    expect(detail).toMatch(/classement collection/);
  });

  it("n'est atteignable que pour une carte possédée", () => {
    // L'album montre une carte non possédée en silhouette, sans titre ni
    // visuel ; une page atteignable en tapant un identifiant défaierait cela
    // en une étape.
    expect(reveal).toMatch(/export async function getOwnedCard/);
    expect(reveal).toMatch(/\.eq\("profile_id", user\.id\)/);
    expect(cardPage).toMatch(/notFound\(\)/);
  });
});

describe("une carte à la fois", () => {
  it("la plus ancienne d'abord", () => {
    // Un pack de cinq devient cinq moments plutôt qu'une liste de cinq
    // lignes, et le participant décide du rythme.
    expect(reveal).toMatch(/\.order\("granted_at", \{ ascending: true \}\)/);
    expect(reveal).toMatch(/\.limit\(1\)/);
  });

  it("et l'écran du jeu annonce ce qui attend", () => {
    const game = code(read("src/app/(participant)/jeu/page.tsx"));

    expect(game).toMatch(/pendingRevealCount/);
    expect(game).toMatch(/à découvrir/);
  });
});
