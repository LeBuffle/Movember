import Link from "next/link";

import { FlagDecision } from "@/components/admin/flag-decision";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { pendingFlags } from "@/lib/integrity/queue";

export const metadata = {
  title: "Arbitrage — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The arbitration queue (story 9.7).
 *
 * **An empty queue is the normal and desirable state**, and the screen says
 * so rather than looking broken. Most of November it will show nothing, which
 * means the rules are not producing false positives — the outcome to hope for.
 *
 * Oldest first: a case left for three weeks is a case whose context nobody
 * remembers, and this queue exists to be emptied rather than browsed.
 */
export default async function ArbitrationPage() {
  const flags = await pendingFlags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Arbitrage
        </h1>
        <p className="text-ink-muted mt-2">
          Les activités que les règles de cohérence ont signalées. Elles ont
          toutes validé leur défi normalement : signaler n’est pas rejeter.
        </p>
      </div>

      {flags.length === 0 ? (
        <Alert tone="success" title="La file est vide">
          Aucune activité signalée. C’est l’état normal — et souhaitable : il
          veut dire que les règles ne produisent pas de faux positifs.
        </Alert>
      ) : (
        <>
          <p className="text-ink-muted text-sm">
            {flags.length} cas en attente, du plus ancien au plus récent.
          </p>

          <ul className="space-y-4">
            {flags.map((flag) => (
              <li
                key={flag.id}
                className="border-line bg-surface rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="orange">{flag.rule}</Badge>
                  <time
                    dateTime={flag.createdAt}
                    className="text-ink-muted text-sm"
                  >
                    signalé le {formatDay(flag.createdAt)}
                  </time>
                </div>

                {/* The observed value against the threshold, both of them.
                    "Vitesse moyenne 47 km/h, seuil 25" can be judged;
                    "activité suspecte" cannot, and would make this a place
                    where you press a button without knowing what you decide. */}
                <p className="text-ink mt-2 text-lg font-bold">
                  {flag.observed} {flag.unit}
                  <span className="text-ink-muted ml-2 text-sm font-normal">
                    seuil : {flag.threshold} {flag.unit}
                  </span>
                </p>

                <p className="text-ink-muted mt-1 text-sm">
                  <Link
                    href={`/admin/participants/${flag.participant.id}`}
                    className="underline underline-offset-4"
                  >
                    {flag.participant.displayName}
                  </Link>
                  {flag.activity && (
                    <>
                      {" · "}
                      {flag.activity.name} · {flag.activity.sportFamily} ·{" "}
                      {formatDay(flag.activity.localDate)} ·{" "}
                      {(flag.activity.distanceMeters / 1000).toLocaleString(
                        "fr-FR",
                        { maximumFractionDigits: 1 },
                      )}{" "}
                      km en {Math.round(flag.activity.durationSeconds / 60)} min
                    </>
                  )}
                </p>

                <div className="border-line mt-4 border-t pt-4">
                  <FlagDecision flagId={flag.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
