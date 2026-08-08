/**
 * How long each kind of data is kept (story 11.4).
 *
 * A pure module, on purpose. **The retention policy is the one part of the
 * GDPR compliance that has to be readable by somebody who does not read
 * code** — the association has to be able to state it, the privacy policy has
 * to match it, and the purge has to apply exactly it. Keeping the durations
 * here, in one list, is what makes those three the same thing.
 *
 * Every duration is counted **from the end of the edition**, not from the row's
 * own date. Two reasons, and the second is the one that matters:
 *
 * 1. It is what the participant is told: "le temps de l'édition et de sa
 *    clôture".
 * 2. A per-row clock would purge an activity from 2 November while the
 *    edition is still running, if the delay were ever shortened by mistake.
 *    Anchoring on the edition means the purge cannot start before the game
 *    is over, whatever the numbers say.
 */

export type RetentionRule = {
  /** The table the purge acts on. */
  table: string;
  /** Months after the edition's last day. */
  months: number;
  /** Why, in French, for the privacy policy and for whoever reads the logs. */
  reason: string;
};

/**
 * The rules, in the order the purge applies them: most personal first.
 *
 * **What is deliberately absent from this list is as important as what is in
 * it.** `payments` is never purged — the association has to justify its
 * donation, and accounting records outlive accounts by law. `admin_audit_log`
 * is never purged either: a log with a horizon is a log that forgets exactly
 * the period somebody would want forgotten. Both are stated in the privacy
 * policy rather than left to be discovered.
 */
export const RETENTION_RULES: RetentionRule[] = [
  {
    table: "shipping_addresses",
    months: 3,
    reason:
      "Adresses postales : effacées trois mois après l’édition, le temps de traiter un colis perdu ou une réexpédition.",
  },
  {
    table: "activity_connections",
    months: 1,
    reason:
      "Jetons d’accès au compte sportif : effacés un mois après l’édition. Plus rien à synchroniser, donc plus rien à conserver.",
  },
  {
    table: "notification_deliveries",
    months: 3,
    reason:
      "Journal des envois : effacé trois mois après l’édition, le temps de comprendre un rappel non reçu.",
  },
  {
    table: "activities",
    months: 6,
    reason:
      "Activités sportives : effacées six mois après l’édition, après la clôture comptable et le traitement des réclamations.",
  },
];

/** Tables the purge never touches, and the reason it never does. */
export const NEVER_PURGED = [
  {
    table: "payments",
    reason:
      "Lignes comptables : conservées pour justifier le don à la fondation. Obligation légale, indépendante du compte.",
  },
  {
    table: "admin_audit_log",
    reason:
      "Journal des gestes d’organisation : conservé. Un journal avec un horizon oublie précisément la période qu’on voudrait oublier.",
  },
] as const;

/**
 * Whether a rule is due, and the cut-off date it applies.
 *
 * @param endsOn the edition's last day, `YYYY-MM-DD`.
 * @returns `null` while the delay has not elapsed — which is the normal
 *   answer every single day until spring, and must not read as an error.
 */
export function purgeDueOn(
  rule: RetentionRule,
  endsOn: string,
  now: Date,
): Date | null {
  const end = new Date(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;

  /* Adding months by hand rather than with `setUTCMonth`, which overflows: on
     an edition ending 30 November, "+3 months" would land on 2 March, because
     February has no 30th. Two days late is harmless for a retention delay —
     but a rule whose date nobody can predict is a rule nobody can state in a
     privacy policy. The day is clamped to the end of the target month. */
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth() + rule.months;
  const lastOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const due = new Date(
    Date.UTC(year, month, Math.min(end.getUTCDate(), lastOfTarget)),
  );

  return now >= due ? due : null;
}

/** The policy as a sentence, for the privacy page and the runbook. */
export function retentionSummary(): string[] {
  return [
    ...RETENTION_RULES.map((rule) => rule.reason),
    ...NEVER_PURGED.map((entry) => entry.reason),
  ];
}
