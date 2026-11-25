/**
 * What a logo may be (stories 14.4 and 14.5).
 *
 * Pure, and kept apart from the upload for the same reason as the card rules:
 * these are what decide whether a captain gets a sentence they can act on or
 * a stack trace, and they should be testable without a session and without a
 * bucket.
 */

/**
 * Two megabytes, three formats.
 *
 * A quarter of what a card visual may weigh, and deliberately. A card is an
 * illustration somebody opens one at a time; a logo is a badge shown forty
 * pixels wide, forty times on one ranking page. What is uploaded is paid for
 * by every participant who opens that screen, on mobile data, every time.
 *
 * ⚠️ The same figure is set on the `logos` bucket by migration
 * `20260813010000`, and a test compares the two. The application check gives
 * the captain a usable sentence; the bucket is what actually holds — a form
 * is whatever the browser agreed to run.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const LOGO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_LOGO_TYPES = Object.keys(LOGO_EXTENSIONS);

export const LOGO_BUCKET = "logos";

/** The shape of a `File` this check needs — so a test does not need one. */
export type LogoCandidate = { size: number; type: string };

export type LogoCheck =
  { ok: true; extension: string } | { ok: false; message: string };

export function checkLogo(file: LogoCandidate): LogoCheck {
  const extension = LOGO_EXTENSIONS[file.type];

  if (!extension) {
    return {
      ok: false,
      message:
        "Ce fichier n’est pas une image acceptée. Utilisez un JPEG, un PNG ou un WebP.",
    };
  }

  if (file.size === 0) {
    return { ok: false, message: "Ce fichier est vide." };
  }

  if (file.size > MAX_LOGO_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);

    return {
      ok: false,
      message: `L’image fait ${megabytes} Mo, la limite est de 2 Mo. Réduisez-la avant de l’envoyer.`,
    };
  }

  return { ok: true, extension };
}

/**
 * Where a logo is filed.
 *
 * A fresh random name every time rather than one derived from the team.
 * Replacing a logo then never overwrites the previous one in place, so a
 * browser or a CDN holding the old address keeps serving a picture that
 * exists — instead of serving the old one under the new name for as long as
 * its cache lasts.
 */
export function logoObjectName(id: string, extension: string): string {
  return `${id}.${extension}`;
}

export function logoPublicUrl(supabaseUrl: string, objectName: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");

  return `${base}/storage/v1/object/public/${LOGO_BUCKET}/${objectName}`;
}

/**
 * Back from the stored URL to the object, so a replaced logo can be swept.
 *
 * @returns `null` for anything that is not one of our own objects. Returning
 *   null rather than guessing is what stops this from ever deleting something
 *   it does not own.
 */
export function logoObjectNameFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const at = url.indexOf(marker);

  if (at === -1) return null;

  const name = url.slice(at + marker.length).split("?")[0] ?? "";

  return name.length > 0 ? name : null;
}

/**
 * Words that carry no initial.
 *
 * Without this list, "Table de Barran" reads as **TD** — which names nothing
 * and is exactly the shape most French team names take. The list is short and
 * stays short: it is here to catch the particle between two real words, not
 * to parse a language.
 */
const PARTICLES = new Set([
  "de",
  "du",
  "des",
  "d",
  "le",
  "la",
  "les",
  "l",
  "au",
  "aux",
  "et",
]);

/**
 * The two letters shown when a team has no logo.
 *
 * A neutral pill rather than a broken image or an empty square: most teams
 * will never upload anything, and a ranking page full of grey holes reads as
 * a fault in the application rather than as a choice nobody made.
 */
export function logoInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s'’-]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));

  if (words.length === 0) return "?";

  const meaningful = words.filter(
    (word) =>
      !PARTICLES.has(word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")),
  );

  // Particles are dropped only when two real words are left. "Les
  // Moustachus" keeps both its letters rather than shrinking to one.
  const chosen = meaningful.length >= 2 ? meaningful : words;

  const letters = chosen
    .slice(0, 2)
    .map(
      (word) =>
        [...word].find((character) => /[\p{L}\p{N}]/u.test(character)) ?? "",
    )
    .join("");

  return letters.toUpperCase() || "?";
}
