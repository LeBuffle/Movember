/**
 * Who a manual send can target.
 *
 * Deliberately apart from the query that resolves it. The list is read by the
 * back-office form — a client component — and the resolution touches the
 * database with the service key. Keeping them in one file would drag
 * `server-only` into the browser bundle, which is exactly the guard doing its
 * job rather than a nuisance to work around.
 *
 * Teams are missing on purpose: they do not exist yet (epic 7). Adding them
 * will be one more entry here and one more branch in `audienceMembers`.
 */

export type Audience = "tous" | "avec-notifications" | "sans-notifications";

export const AUDIENCES: Array<{
  value: Audience;
  label: string;
  hint: string;
}> = [
  {
    value: "tous",
    label: "Tous les participants inscrits",
    hint: "Chacun par le moyen qui le concerne : notification, ou e-mail à défaut.",
  },
  {
    value: "avec-notifications",
    label: "Ceux qui ont activé les notifications",
    hint: "Les plus réactifs. Utile pour un message qui ne vaut que dans l’heure.",
  },
  {
    value: "sans-notifications",
    label: "Ceux qui n’ont pas activé les notifications",
    hint: "Pour les relancer sur l’installation. Ils recevront un e-mail.",
  },
];

export function isAudience(value: string): value is Audience {
  return AUDIENCES.some((entry) => entry.value === value);
}
