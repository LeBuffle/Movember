import { z } from "zod";

import { RARITY_ORDER, type Rarity } from "@/lib/cards/draw";

/**
 * What the card back-office accepts, decided once and in plain functions.
 *
 * Kept apart from the server action so the rules can be tested without a
 * database and without a session — the rules are the part that decides
 * whether a volunteer gets a sentence they can act on or a stack trace.
 */

/**
 * The rarities in French, for the moments a label has not been read from the
 * database.
 *
 * `card_rarities.label` remains the source of truth wherever a query is
 * already being made; this is the fallback for the screens that would
 * otherwise fetch four rows to display four words.
 */
export const RARITY_LABELS: Record<Rarity, string> = {
  commune: "Commune",
  rare: "Rare",
  epique: "Épique",
  legendaire: "Légendaire",
};

export const RARITY_CHOICES = RARITY_ORDER.map((slug) => ({
  value: slug,
  label: RARITY_LABELS[slug],
}));

export const cardDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Le titre doit faire au moins 2 caractères.")
    .max(120, "Le titre ne peut pas dépasser 120 caractères."),
  description: z
    .string()
    .trim()
    .max(2000, "La description ne peut pas dépasser 2000 caractères."),
  rarity: z.enum(RARITY_ORDER as [Rarity, ...Rarity[]]),
});

export type CardDetails = z.infer<typeof cardDetailsSchema>;

/** Field names in the words of the person filling the form, not of the code. */
export const CARD_DETAIL_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  rarity: "Rareté",
};

/**
 * The picture.
 *
 * Two megabytes, three formats. Not an arbitrary tightening: the album shows
 * a dozen thumbnails at once, on a phone, often on mobile data — a 6 MB PNG
 * uploaded by mistake is paid for by every participant who opens the screen,
 * every time.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_EXTENSIONS);

/** The shape of a `File` this check needs — so a test does not need one. */
export type ImageCandidate = { size: number; type: string };

export type ImageCheck =
  { ok: true; extension: string } | { ok: false; message: string };

export function checkImage(file: ImageCandidate): ImageCheck {
  const extension = IMAGE_EXTENSIONS[file.type];

  if (!extension) {
    return {
      ok: false,
      message:
        "Ce fichier n’est pas une image acceptée. Utilisez un JPEG, un PNG ou un WebP.",
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);

    return {
      ok: false,
      message: `L’image fait ${megabytes} Mo, la limite est de 2 Mo. Réduisez-la avant de la téléverser.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: "Ce fichier est vide." };
  }

  return { ok: true, extension };
}

export const CARD_BUCKET = "cartes";

/**
 * Where a picture is filed.
 *
 * A fresh random name every time rather than one derived from the card.
 * Replacing a visual then never overwrites the previous one in place, so a
 * browser or a CDN holding the old address keeps serving a picture that
 * exists — instead of serving the old one under the new name for as long as
 * its cache lasts.
 */
export function imageObjectName(id: string, extension: string): string {
  return `${id}.${extension}`;
}

/**
 * The address the album will use.
 *
 * `image_path` holds a complete URL, which is why the album can render it
 * with a plain `<img src>` and why moving the pictures elsewhere one day
 * would be a change to this function alone.
 */
export function imagePublicUrl(
  supabaseUrl: string,
  objectName: string,
): string {
  const base = supabaseUrl.replace(/\/+$/, "");

  return `${base}/storage/v1/object/public/${CARD_BUCKET}/${objectName}`;
}

/**
 * Back from the stored URL to the object, so a replaced picture can be swept.
 *
 * @returns `null` for anything that is not one of our own objects — a URL
 *   typed by hand, or one from a previous arrangement. Returning null rather
 *   than guessing is what stops this from ever deleting something it does not
 *   own.
 */
export function imageObjectNameFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${CARD_BUCKET}/`;
  const at = url.indexOf(marker);

  if (at === -1) return null;

  const name = url.slice(at + marker.length).split("?")[0] ?? "";

  return name.length > 0 ? name : null;
}

/**
 * The rarity weights (AC 5).
 *
 * Relative, not percentages: 60/28/10/2 and 600/280/100/20 describe the same
 * game. That is what lets one be nudged without having to make the others add
 * up again — and it is worth saying on the screen, because a volunteer typing
 * "50" into a box labelled "poids" will otherwise assume it means 50 %.
 */
export type WeightEntry = { slug: Rarity; weight: number };

export type WeightCheck =
  | { ok: true; weights: WeightEntry[] }
  | { ok: false; errors: Record<string, string> };

export function parseRarityWeights(
  raw: Record<string, string | undefined>,
): WeightCheck {
  const errors: Record<string, string> = {};
  const weights: WeightEntry[] = [];

  for (const slug of RARITY_ORDER) {
    const value = (raw[slug] ?? "").trim();

    if (value === "") {
      errors[slug] = "Indiquez un poids. Mettez 0 pour retirer cette rareté.";
      continue;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed)) {
      errors[slug] = "Indiquez un nombre entier.";
      continue;
    }

    if (parsed < 0) {
      errors[slug] = "Un poids ne peut pas être négatif.";
      continue;
    }

    if (parsed > 100000) {
      errors[slug] = "Ce poids est trop grand. Restez sous 100 000.";
      continue;
    }

    weights.push({ slug, weight: parsed });
  }

  // Every weight at zero has no meaning: the draw would then return nothing
  // at all, and every completed challenge would hand out no card without
  // anything on screen explaining why.
  if (
    Object.keys(errors).length === 0 &&
    weights.every((entry) => entry.weight === 0)
  ) {
    errors.commune =
      "Au moins une rareté doit avoir un poids supérieur à zéro, sinon plus aucune carte n’est tirée.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, weights };
}

/**
 * What the catalogue screen is showing.
 *
 * Read from the address bar rather than kept in component state, like the
 * challenge catalogue: the list survives a back button, and a filtered view
 * can be sent to somebody else as a link.
 */
export type CardFilters = {
  status: "all" | "published" | "draft";
  rarity: Rarity | null;
};

export function parseCardFilters(
  params: Record<string, string | string[] | undefined>,
): CardFilters {
  const first = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const status = first("etat");
  const rarity = first("rarete");

  return {
    status:
      status === "published" || status === "draft" || status === "all"
        ? status
        : "all",
    rarity: (RARITY_ORDER as string[]).includes(rarity)
      ? (rarity as Rarity)
      : null,
  };
}

/**
 * The odds, as the volunteer will read them.
 *
 * The screen shows percentages even though the stored value is a weight,
 * because "2 %" is the number the PRD talks about and the number anyone can
 * argue with. The percentage is derived, never stored — storing it would
 * bring back the problem of four numbers that have to add up.
 */
export function weightShares(
  weights: readonly WeightEntry[],
): Array<WeightEntry & { share: number }> {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);

  return weights.map((entry) => ({
    ...entry,
    share: total > 0 ? (entry.weight / total) * 100 : 0,
  }));
}
