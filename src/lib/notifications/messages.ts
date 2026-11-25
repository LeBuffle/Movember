import type { CompletedChallenge } from "@/lib/challenges/completion";
import {
  buildPayload,
  type NotificationPayload,
} from "@/lib/notifications/payload";

/**
 * What the notifications actually say.
 *
 * Pure, and apart from the sending, for one reason: the wording is the part
 * that gets corrected after somebody reads it on a phone and finds it flat.
 * Correcting it should not mean touching anything that sends.
 *
 * Two rules run through all of them:
 *
 * **The title of the challenge, never a generic sentence.** "5 km avant le
 * café" makes somebody want to go out; "vous avez un nouveau défi" is swiped
 * away unread. The one useful thing a notification can carry is the specific
 * thing.
 *
 * **One message for several events.** A long Sunday outing can settle a
 * distance challenge, an elevation challenge and a cumulative one at once.
 * Three notifications in a row read as noise, and noise gets switched off
 * (architecture §7).
 */

/** The morning message (story 6.5). */
export function dailyChallengeMessage(
  titles: string[],
): NotificationPayload | null {
  if (titles.length === 0) return null;

  if (titles.length === 1) {
    return buildPayload({
      title: "Votre défi du jour",
      body: titles[0]!,
      url: "/jeu",
      tag: "defi-du-jour",
    });
  }

  return buildPayload({
    title: `Vos ${titles.length} défis du jour`,
    // Listed rather than counted: the first two are what somebody decides on
    // while walking to the kitchen.
    body: titles.join(" · "),
    url: "/jeu",
    tag: "defi-du-jour",
  });
}

/**
 * The validation message, grouped (story 6.6).
 *
 * @returns `null` when nothing was completed, so the caller has nothing to
 *   decide.
 */
export function completionMessage(
  completions: CompletedChallenge[],
): NotificationPayload | null {
  if (completions.length === 0) return null;

  const cards = completions.filter((entry) => entry.cardGranted).length;

  if (completions.length === 1) {
    return buildPayload({
      title: "Défi réussi",
      body:
        cards > 0
          ? `${completions[0]!.title} — une carte vous attend.`
          : completions[0]!.title,
      // Straight to the reveal when there is something to open, which is the
      // moment the whole collection lives on (story 5.5).
      url: cards > 0 ? "/jeu/collection/reveler" : "/jeu",
      tag: "defis-valides",
    });
  }

  return buildPayload({
    title: `${completions.length} défis réussis`,
    body:
      cards > 0
        ? `${describeCards(cards)} vous ${cards > 1 ? "attendent" : "attend"}.`
        : completions.map((entry) => entry.title).join(" · "),
    url: cards > 0 ? "/jeu/collection/reveler" : "/jeu",
    tag: "defis-valides",
  });
}

function describeCards(count: number): string {
  return count === 1 ? "Une carte" : `${count} cartes`;
}
