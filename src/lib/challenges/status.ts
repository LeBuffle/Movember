/**
 * Challenge state, shared between the game engine (epic 4) and the UI.
 *
 * A challenge that has not been completed stays `open` and can still be
 * validated later: no challenge ever blocks another (PRD, decision D3).
 */
export type ChallengeStatusValue = "open" | "succeeded" | "failed";

/**
 * Text label per state.
 *
 * Lives here rather than inside the component because it is what makes a
 * state readable when colour is not perceived — the rule that no state is
 * ever conveyed by colour alone (story 1.5, AC 6). Keeping it importable
 * without pulling in React lets it be asserted on directly.
 */
export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatusValue, string> = {
  open: "À faire",
  succeeded: "Réussi",
  failed: "Manqué",
};
