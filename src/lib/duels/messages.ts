/**
 * What the application says when a duel ends (story 12.6).
 *
 * **A fixed catalogue, and no free text anywhere.** This is the
 * non-negotiable point of the story: a message field between participants
 * would turn the mechanism into a messaging service, with everything that
 * implies in moderation, reporting and liability for a volunteer association.
 * The sentences are written once, here, and drawn at random when a duel ends.
 *
 * **The humour aims at the duel, never at the person.** "Ton défi a été plus
 * fort que lui" and not "il n'a pas réussi". That distinction is the whole
 * difference between a joke between colleagues and a jab — and it is decided
 * entirely in the wording below.
 *
 * A pure module: no database, no clock. The key of the drawn sentence is
 * stored on the duel so the sender reads the same one every time they open
 * the screen; a sentence that changes at each refresh reads as a defect.
 */

export type ExpiryMessage = { key: string; text: string };

/**
 * Sent to the person who launched a duel that was not met.
 *
 * Read them out loud before adding one. Each has to work when the receiver is
 * a colleague you will see on Monday.
 */
export const EXPIRY_MESSAGES: ExpiryMessage[] = [
  {
    key: "plus-fort",
    text: "Ton défi a été plus fort que lui. Le chrono a gagné cette fois.",
  },
  {
    key: "canape",
    text: "Ton défi est resté sans réponse. Le canapé a plaidé sa cause avec talent.",
  },
  {
    key: "moustache",
    text: "Défi non relevé : ta moustache reste invaincue sur ce coup-là.",
  },
  {
    key: "24h",
    text: "Les 24 heures sont passées. Ton défi part à la retraite avec les honneurs.",
  },
  {
    key: "prochaine",
    text: "Personne n’a relevé celui-là. À toi de choisir la prochaine victime.",
  },
];

export const EXPIRY_MESSAGE_KEYS: string[] = EXPIRY_MESSAGES.map(
  (message) => message.key,
);

/**
 * The sentence a stored key stands for.
 *
 * @returns the first message when the key is unknown — a sentence written
 *   before a catalogue edit must not leave a blank on the screen. An empty
 *   message would read as a bug at exactly the moment the game is trying to
 *   be light.
 */
export function expiryMessage(key: string | null): string {
  const found = EXPIRY_MESSAGES.find((message) => message.key === key);
  return (found ?? EXPIRY_MESSAGES[0]!).text;
}
