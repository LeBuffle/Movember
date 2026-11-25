/**
 * What kind of team this is.
 *
 * Apart from everything that touches the database, because the creation form
 * is a client component and needs these labels. Keeping them beside
 * `membership.ts` would drag `server-only` into the browser bundle — which is
 * that guard working, not an inconvenience to route around.
 *
 * The kind has **no effect on the game**: same challenges, same scoring, same
 * ranking. It exists so a list of two hundred teams can be read, and the
 * screen says so rather than letting anybody wonder.
 */

export type TeamKind = "libre" | "entreprise" | "association";

export const TEAM_KINDS: Array<{ value: TeamKind; label: string }> = [
  { value: "libre", label: "Équipe libre" },
  { value: "entreprise", label: "Entreprise" },
  { value: "association", label: "Association ou club" },
];

export function isTeamKind(value: string): value is TeamKind {
  return TEAM_KINDS.some((entry) => entry.value === value);
}
