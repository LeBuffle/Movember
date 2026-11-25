import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkImage,
  imageObjectName,
  imageObjectNameFromUrl,
  imagePublicUrl,
  MAX_IMAGE_BYTES,
  parseCardFilters,
  parseRarityWeights,
  weightShares,
} from "@/lib/cards/form";

/* =========================================================================
 * Le back-office des cartes (story 5.6)
 *
 * Ce qui rend l'epic 5 tenable malgré des visuels qui arriveront en retard :
 * une carte se publie le jour où son image existe, pas le jour où le code
 * sort. Rien ici ne doit donc dépendre d'un déploiement — et une carte
 * publiée ne doit jamais pouvoir disparaître de la collection de quelqu'un.
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
  read("supabase/migrations/20260806150000_card_images.sql"),
);
const actions = code(read("src/lib/cards/admin-actions.ts"));
const storage = code(read("src/lib/cards/storage.ts"));
const grant = code(read("src/lib/cards/grant.ts"));
const catalogue = code(read("src/app/(admin)/admin/cartes/page.tsx"));
const detail = code(read("src/app/(admin)/admin/cartes/[id]/page.tsx"));

describe("une carte non publiée n'est jamais tirée", () => {
  it("le tirage ne lit que le catalogue publié", () => {
    // AC 3. C'est aussi ce qui permet de préparer cinquante titres en
    // septembre sans qu'aucun ne sorte avant d'être prêt.
    expect(grant).toMatch(/from\("cards"\)[\s\S]{0,200}published_at/);
    expect(grant).toMatch(/\.not\("published_at", "is", null\)/);
  });

  it("et rien n'est mis en cache entre la publication et le tirage", () => {
    // AC 7 : une carte publiée à neuf heures peut sortir à neuf heures une.
    // Le catalogue est relu à chaque défi validé, pas au démarrage.
    expect(grant).toMatch(/export async function drawableCatalogue/);
    expect(grant).not.toMatch(/const CATALOGUE\s*=/);
  });
});

describe("une carte publiée ne peut plus être supprimée", () => {
  it("la base refuse, pas seulement l'écran", () => {
    // AC 4. Quelqu'un l'a dans son album : la supprimer retirerait un défi
    // réussi de son historique.
    expect(migration).toMatch(/create trigger cards_no_delete_once_published/);
    expect(migration).toMatch(/before delete on public\.cards/);
    expect(migration).toMatch(/if old\.published_at is not null then/);
    expect(migration).toMatch(/raise exception/);
  });

  it("la suppression porte sa garde dans l'écriture elle-même", () => {
    const region = actions.slice(
      actions.indexOf("export async function deleteCard"),
    );

    expect(region).toMatch(/\.delete\(\)/);
    expect(region).toMatch(/\.is\("published_at", null\)/);
  });

  it("et l'écran ne propose le bouton que quand c'est possible", () => {
    // Un bouton qui ne produit jamais qu'un refus apprend à ignorer les refus.
    expect(detail).toMatch(/\{!published && \(/);
    expect(detail).toMatch(/CardDelete/);
  });
});

describe("publier et dépublier", () => {
  it("passe par la session de l'administrateur, jamais par la clé de service", () => {
    // Même règle que le catalogue de défis : c'est la base qui décide, pas ce
    // fichier qui se souvient de vérifier.
    expect(actions).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(actions).not.toMatch(/supabase\/admin/);
  });

  it("vérifie le rôle avant toute écriture", () => {
    for (const name of [
      "saveCard",
      "setCardPublished",
      "deleteCard",
      "saveRarityWeights",
    ]) {
      const region = actions.slice(
        actions.indexOf(`export async function ${name}`),
      );
      const guard = region.indexOf("requireAdmin()");
      const write = region.search(/\.(insert|update|delete)\(/);

      expect(guard, `${name} n'appelle pas requireAdmin()`).toBeGreaterThan(-1);
      expect(
        write === -1 || guard < write,
        `${name} écrit avant d'avoir vérifié le rôle`,
      ).toBe(true);
    }
  });

  it("ne reprend pas la date de publication à chaque appui", () => {
    const region = actions.slice(
      actions.indexOf("export async function setCardPublished"),
    );

    expect(region).toMatch(/\.is\("published_at", null\)/);
    expect(region).toMatch(/\.not\("published_at", "is", null\)/);
  });

  it("dépublier ne retire rien à personne", () => {
    // La dépublication ne touche que les tirages à venir : `card_grants`
    // n'est jamais écrit ici.
    expect(actions).not.toMatch(/card_grants/);
  });
});

describe("chaque action est journalisée", () => {
  it.each([
    ["card.created", /card\.created/],
    ["card.updated", /card\.updated/],
    ["card.published", /card\.published/],
    ["card.unpublished", /card\.unpublished/],
    ["card.deleted", /card\.deleted/],
    ["card_rarities.reweighted", /card_rarities\.reweighted/],
  ])("%s", (_name, pattern) => {
    // AC 6. « Qui a publié cette carte, et quand » est une question qui se
    // pose en décembre, pas pendant l'action.
    expect(actions).toMatch(pattern);
  });

  it("garde les poids d'avant en changeant les probabilités", () => {
    // « Les probabilités ont changé le 12 » est ce qu'on cherche à savoir
    // après coup, en comparant sa chance à celle d'un ami.
    const region = actions.slice(
      actions.indexOf("export async function saveRarityWeights"),
    );

    expect(region).toMatch(/before/);
    expect(region).toMatch(/after/);
  });

  it("ne journalise aucune donnée personnelle", () => {
    expect(actions).not.toMatch(/email/i);
    expect(actions).not.toMatch(/display_name/);
  });
});

describe("le visuel", () => {
  it("est téléversé avant l'écriture de la carte, jamais après", () => {
    // Les deux ordres échouent différemment, et un seul échoue correctement :
    // l'autre laisse une carte enregistrée sans son image et un bénévole qui
    // croit avoir fini.
    const region = actions.slice(
      actions.indexOf("export async function saveCard"),
    );
    const upload = region.indexOf("uploadImage");
    const write = region.search(/\.(insert|update)\(/);

    expect(upload).toBeGreaterThan(-1);
    expect(upload).toBeLessThan(write);
  });

  it("passe par la session de l'administrateur", () => {
    expect(storage).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(storage).not.toMatch(/supabase\/admin/);
  });

  it("n'écrase jamais un objet existant", () => {
    // Le nom est aléatoire : une collision voudrait dire qu'autre chose ne va
    // pas, pas qu'on remplace une image.
    expect(storage).toMatch(/upsert: false/);
    expect(storage).toMatch(/randomUUID/);
  });

  it("refuse ce qui n'est pas une image acceptée", () => {
    expect(checkImage({ size: 1000, type: "application/pdf" }).ok).toBe(false);
    expect(checkImage({ size: 1000, type: "image/gif" }).ok).toBe(false);
  });

  it("refuse au-delà de deux mégaoctets", () => {
    // Payé par chaque participant qui ouvre l'album, à chaque fois.
    const refused = checkImage({
      size: MAX_IMAGE_BYTES + 1,
      type: "image/png",
    });

    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.message).toMatch(/8 Mo/);
  });

  it("accepte les trois formats attendus", () => {
    expect(checkImage({ size: 1000, type: "image/jpeg" })).toEqual({
      ok: true,
      extension: "jpg",
    });
    expect(checkImage({ size: 1000, type: "image/png" })).toEqual({
      ok: true,
      extension: "png",
    });
    expect(checkImage({ size: 1000, type: "image/webp" })).toEqual({
      ok: true,
      extension: "webp",
    });
  });

  it("refuse un fichier vide", () => {
    expect(checkImage({ size: 0, type: "image/png" }).ok).toBe(false);
  });

  it("est servi depuis le stockage, par une adresse publique", () => {
    // AC 2. L'album l'affiche avec un simple <img src>.
    const url = imagePublicUrl(
      "https://projet.supabase.co/",
      imageObjectName("abc", "png"),
    );

    expect(url).toBe(
      "https://projet.supabase.co/storage/v1/object/public/cartes/abc.png",
    );
  });

  it("se retrouve depuis son adresse, pour balayer l'ancienne image", () => {
    expect(
      imageObjectNameFromUrl(
        "https://projet.supabase.co/storage/v1/object/public/cartes/abc.png",
      ),
    ).toBe("abc.png");
  });

  it("ne supprime jamais ce qui ne lui appartient pas", () => {
    // Une URL tapée à la main, ou venue d'un autre arrangement : on préfère
    // ne rien faire à deviner.
    expect(imageObjectNameFromUrl("https://exemple.fr/photo.png")).toBeNull();
    expect(
      imageObjectNameFromUrl(
        "https://projet.supabase.co/storage/v1/object/public/autre/abc.png",
      ),
    ).toBeNull();
  });
});

describe("le stockage des visuels", () => {
  it("borne la taille et les formats côté base aussi", () => {
    // Le contrôle applicatif donne au bénévole une phrase actionnable ;
    // celui-ci est ce qui tient si une requête arrive autrement.
    expect(migration).toMatch(/insert into storage\.buckets/);
    // La limite du seau et celle du code doivent rester identiques : une base
    // plus permissive donne un refus applicatif là où le fichier serait passé,
    // et l'inverse une erreur de stockage après une longue attente.
    const bucketLimit = read(
      "supabase/migrations/20260806240000_card_image_size.sql",
    );

    expect(bucketLimit).toMatch(/file_size_limit = 8388608/);
    expect(MAX_IMAGE_BYTES).toBe(8388608);
    expect(migration).toMatch(/image\/jpeg/);
    expect(migration).toMatch(/image\/webp/);
  });

  it("n'ouvre l'écriture qu'aux administrateurs", () => {
    expect(migration).toMatch(
      /create policy "admins upload card images"[\s\S]*?is_admin/,
    );
    expect(migration).toMatch(
      /create policy "admins remove card images"[\s\S]*?is_admin/,
    );
  });
});

describe("les poids de rareté", () => {
  it("sont modifiables depuis le back-office", () => {
    // AC 5. C'est la raison pour laquelle card_rarities est une table.
    expect(actions).toMatch(/from\("card_rarities"\)/);
    expect(actions).toMatch(/\.update\(\{ weight/);
  });

  it("acceptent des entiers positifs", () => {
    const checked = parseRarityWeights({
      commune: "60",
      rare: "28",
      epique: "10",
      legendaire: "2",
    });

    expect(checked.ok).toBe(true);
    expect(checked.ok === true && checked.weights).toEqual([
      { slug: "commune", weight: 60 },
      { slug: "rare", weight: 28 },
      { slug: "epique", weight: 10 },
      { slug: "legendaire", weight: 2 },
    ]);
  });

  it("acceptent zéro, qui retire une rareté du tirage", () => {
    const checked = parseRarityWeights({
      commune: "60",
      rare: "28",
      epique: "10",
      legendaire: "0",
    });

    expect(checked.ok).toBe(true);
  });

  it("refusent que tout soit à zéro", () => {
    // Plus aucune carte ne serait tirée, et rien à l'écran ne dirait pourquoi.
    const checked = parseRarityWeights({
      commune: "0",
      rare: "0",
      epique: "0",
      legendaire: "0",
    });

    expect(checked.ok).toBe(false);
  });

  it("refusent un poids négatif ou décimal", () => {
    expect(
      parseRarityWeights({
        commune: "-1",
        rare: "28",
        epique: "10",
        legendaire: "2",
      }).ok,
    ).toBe(false);

    expect(
      parseRarityWeights({
        commune: "60,5",
        rare: "28",
        epique: "10",
        legendaire: "2",
      }).ok,
    ).toBe(false);
  });

  it("refusent un champ vide plutôt que de supposer zéro", () => {
    const checked = parseRarityWeights({
      commune: "",
      rare: "28",
      epique: "10",
      legendaire: "2",
    });

    expect(checked.ok).toBe(false);
    expect(checked.ok === false && checked.errors.commune).toMatch(/poids/i);
  });

  it("se lisent en pourcentages, qui restent dérivés", () => {
    // Personne ne pense en poids. Le pourcentage est calculé, jamais stocké :
    // le stocker ramènerait quatre nombres qui doivent tomber juste.
    const shares = weightShares([
      { slug: "commune", weight: 60 },
      { slug: "rare", weight: 28 },
      { slug: "epique", weight: 10 },
      { slug: "legendaire", weight: 2 },
    ]);

    expect(shares.map((entry) => Math.round(entry.share))).toEqual([
      60, 28, 10, 2,
    ]);
  });
});

describe("les filtres du catalogue", () => {
  it("vivent dans la barre d'adresse", () => {
    // La liste survit au bouton retour, et peut s'envoyer en lien.
    expect(catalogue).toMatch(/method="get"/);
    expect(catalogue).toMatch(/parseCardFilters/);
  });

  it("ignorent une valeur inventée plutôt que de refuser la page", () => {
    expect(parseCardFilters({ etat: "n'importe quoi" }).status).toBe("all");
    expect(parseCardFilters({ rarete: "dorée" }).rarity).toBeNull();
  });

  it("lisent ce qu'ils connaissent", () => {
    expect(parseCardFilters({ etat: "draft", rarete: "epique" })).toEqual({
      status: "draft",
      rarity: "epique",
    });
  });
});

describe("le catalogue dit où il en est", () => {
  it("prévient quand aucune carte n'est publiée", () => {
    // L'état normal jusqu'en septembre — pas une erreur, mais une conséquence
    // qui mérite d'être écrite : les défis réussis ne donnent aucune carte.
    expect(catalogue).toMatch(/Aucune carte publiée/);
  });

  it("signale une carte en jeu sans visuel", () => {
    expect(catalogue).toMatch(/Visuel manquant/);
  });
});

describe("le format d'une carte", () => {
  it("est déclaré une seule fois", () => {
    // Quatre écrans dessinent une carte — l'album, la révélation, la galerie
    // publique et l'aperçu du back-office. Un rapport qui dérive entre eux,
    // c'est un catalogue qui paraît faux sur un écran sur quatre.
    expect(read("src/app/globals.css")).toMatch(/--aspect-carte:/);
  });

  it("et suit les proportions des visuels réels", () => {
    for (const screen of [
      "src/components/cards/card-detail.tsx",
      "src/components/cards/card-face.tsx",
      "src/app/(public)/cartes/page.tsx",
      "src/components/admin/card-form.tsx",
    ]) {
      const source = read(screen);

      expect(source).toMatch(/aspect-carte/);
      expect(source).not.toMatch(/aspect-3\/4/);
    }
  });
});
