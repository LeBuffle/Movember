/**
 * What a notification actually contains.
 *
 * Deliberately small, and pure, so the rules below can be tested without a
 * push service. Two of them matter more than they look:
 *
 * **Nothing personal travels in a payload.** A title, a body, a path inside
 * the application. A push payload passes through the browser vendor's push
 * service and then sits on the device — what is not sent cannot leak from
 * either. So no identifier, no score, no e-mail address, nothing the
 * notification does not already display on screen.
 *
 * **Lengths are cut here, not by the phone.** Every platform truncates
 * differently and none of them tell you; a sentence with its point at the end
 * becomes a sentence with no point. Cutting at a known length means what
 * matters is written first because the author can see the limit.
 */

export type NotificationCategory =
  "defi_du_jour" | "resultat" | "carte" | "annonce" | "relance";

/** The categories the e-mail fallback covers (architecture D6). */
export const ESSENTIAL_CATEGORIES: NotificationCategory[] = [
  "defi_du_jour",
  "annonce",
  "relance",
];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  defi_du_jour: "Défi du jour",
  resultat: "Défi validé",
  carte: "Nouvelle carte",
  annonce: "Annonces de l’organisation",
  relance: "Relances",
};

export const MAX_TITLE = 60;
export const MAX_BODY = 160;

export type NotificationPayload = {
  title: string;
  body: string;
  /** Where touching it lands. A path inside the application, never a URL. */
  url: string;
  /** Same tag replaces rather than stacks, so a group reads as one event. */
  tag?: string;
};

export type PayloadInput = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export function buildPayload(input: PayloadInput): NotificationPayload {
  return {
    title: clip(input.title, MAX_TITLE) || "DEFI Movember",
    body: clip(input.body ?? "", MAX_BODY),
    url: safePath(input.url),
    tag: input.tag,
  };
}

/**
 * Cut on a word, with an ellipsis, never mid-syllable.
 *
 * A body cut at exactly 160 characters reads as a bug; the same body cut at
 * 154 with "…" reads as a summary.
 */
function clip(text: string, limit: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= limit) return trimmed;

  const cut = trimmed.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Only ever a path inside the application.
 *
 * Not a defence against an attacker — the payload is written by our own
 * sender — but against a typo in a message composed from the back-office
 * (story 6.8) turning into a notification that leaves the application.
 * `//host` and `/\host` are both browser-recognised ways out, hence the
 * second character being checked as well as the first.
 */
export function safePath(url: string | undefined): string {
  if (!url || !/^\/(?![/\\])/.test(url)) return "/jeu";

  return url;
}
