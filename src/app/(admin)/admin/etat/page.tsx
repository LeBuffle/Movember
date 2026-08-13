import Link from "next/link";

import { StravaDiagnostic } from "@/components/activities/strava-diagnostic";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { diagnoseStravaAction } from "@/lib/activities/diagnostic-actions";
import { activitySyncHealth } from "@/lib/activities/health";
import { APP_ENVIRONMENT, APP_VERSION } from "@/lib/app-version";

export const metadata = {
  title: "État des intégrations — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Whether the outside world is still answering (NFR26).
 *
 * The screen somebody opens when three participants say their run did not
 * count. It answers the only question worth answering first — is this us, or
 * is this Strava? — before anybody starts reading a log file on a phone.
 *
 * Nothing here is a live probe: probing Strava on every page load would spend
 * the call quota to answer a question the data already answers. What is shown
 * is what the links themselves say about when they were last reached.
 */
export default async function IntegrationsPage() {
  const activities = await activitySyncHealth();

  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const notifications = Boolean(process.env.VAPID_PRIVATE_KEY);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin" className="underline underline-offset-4">
            Back-office
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          État des intégrations
        </h1>
        <p className="text-ink-muted mt-2">
          {APP_ENVIRONMENT} — version {APP_VERSION}
        </p>
      </div>

      {activities.state === "down" && activities.links > 0 && (
        <Alert tone="danger" title="Plus aucune sortie ne remonte">
          Aucun compte relié n’a été atteint depuis trois heures. Si Strava
          fonctionne par ailleurs, regardez les journaux de la tâche de
          rattrapage. Aucun défi n’est marqué manqué pendant ce temps : ils
          restent ouverts et se valideront au rétablissement.
        </Alert>
      )}

      {activities.state === "degraded" && (
        <Alert tone="warning" title="Synchronisation perturbée">
          Une partie des comptes n’a pas été atteinte récemment. C’est le
          symptôme d’une indisponibilité passagère de Strava ou d’un dépassement
          de quota d’appels. Le rattrapage reprendra tout seul.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card accent={activities.state === "down"}>
          <CardTitle>Activités sportives</CardTitle>
          <CardBody>
            <SyncBadge state={activities.state} />

            <ul className="text-ink mt-3 space-y-1 text-sm">
              <li>{activities.links} compte(s) relié(s)</li>
              <li>{activities.recent} atteint(s) dans les trois heures</li>
              <li>{activities.broken} liaison(s) rompue(s)</li>
            </ul>

            <p className="text-ink-muted mt-3 text-sm">
              {activities.lastSyncedAt
                ? `Dernière remontée le ${new Date(activities.lastSyncedAt).toLocaleString("fr-FR")}.`
                : "Aucune remontée pour l’instant."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Paiement</CardTitle>
          <CardBody>
            <Badge tone={stripe ? "success" : "neutral"}>
              {stripe ? "Configuré" : "Non configuré"}
            </Badge>
            <p className="text-ink-muted mt-3 text-sm">
              L’état réel des encaissements se lit dans{" "}
              <Link
                href="/admin/collecte"
                className="underline underline-offset-4"
              >
                Collecte
              </Link>
              .
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Notifications</CardTitle>
          <CardBody>
            <Badge tone={notifications ? "success" : "neutral"}>
              {notifications ? "Configuré" : "Non configuré"}
            </Badge>
            <p className="text-ink-muted mt-3 text-sm">
              Les envois arrivent avec le lot 6.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardTitle>Diagnostic Strava</CardTitle>
        <CardBody>
          <div className="mt-2">
            <StravaDiagnostic action={diagnoseStravaAction} />
          </div>
        </CardBody>
      </Card>

      <Alert tone="info" title="Ce que cet écran ne fait pas">
        Il ne teste rien en direct, sauf si vous lancez le diagnostic ci-dessus.
        Interroger Strava à chaque affichage dépenserait le quota d’appels pour
        répondre à une question que les liaisons elles-mêmes renseignent déjà.
      </Alert>
    </div>
  );
}

function SyncBadge({ state }: { state: string }) {
  const tone =
    state === "ok"
      ? "success"
      : state === "degraded"
        ? "orange"
        : state === "down"
          ? "danger"
          : "neutral";

  const label =
    state === "ok"
      ? "Les sorties remontent"
      : state === "degraded"
        ? "Perturbée"
        : state === "down"
          ? "Interrompue"
          : state === "idle"
            ? "Aucun compte relié"
            : "Strava non configuré";

  return (
    <Badge tone={tone as "success" | "orange" | "danger" | "neutral"}>
      {label}
    </Badge>
  );
}
