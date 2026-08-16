import Link from "next/link";

import {
  Disconnect,
  Resynchronise,
} from "@/components/activities/connection-panel";
import {
  ConsentForm,
  WithdrawConsent,
} from "@/components/activities/consent-form";
import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getOwnConnection } from "@/lib/activities/connection";
import { ownManualCount } from "@/lib/activities/own";
import {
  CONSENT_COLLECTED,
  ACTIVITY_SHARING,
  CONSENT_NEVER_COLLECTED,
  getConsent,
} from "@/lib/activities/consent";
import {
  grantActivityConsent,
  withdrawActivityConsent,
} from "@/lib/activities/consent-actions";
import {
  disconnectAccount,
  resynchronise,
} from "@/lib/activities/sync-actions";
import { ROUTES } from "@/lib/auth/routes";
import { editionStartDate } from "@/lib/edition/start";

export const metadata = {
  title: "Mes activités sportives — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The consent screen, and the gate to connecting a sporting account.
 *
 * **Saying what is not collected is more reassuring than saying what is.**
 * "We retrieve your activities" worries people; "we never store your GPS
 * track or your heart rate" answers the question they are actually asking.
 * And it is true — it is architecture decision D9, and the schema of story
 * 3.1 has no column for either.
 *
 * Consent is collected *here*, before any redirection to a provider (FR23),
 * and separately from the terms of sale. Folding the two together is what
 * makes a consent legally worthless: it has to be specific.
 *
 * Story 3.3 adds the connection button below, and it only exists once this
 * has been given.
 */
export default async function ActivityConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = query.erreur;
  const failure = Array.isArray(raw) ? raw[0] : raw;

  const [consent, connection, manual, editionStart] = await Promise.all([
    getConsent(),
    getOwnConnection(),
    ownManualCount(),
    editionStartDate(),
  ]);

  const editionStarted = new Date() >= editionStart;

  return (
    <ParticipantShell title="Mes activités sportives" eyebrow="Mon compte">
      <p className="text-ink-muted">
        Le jeu valide vos défis à partir de vos sorties enregistrées sur Strava.
        Voici exactement ce que cela veut dire.
      </p>

      <div className="mt-8 grid gap-4">
        <Card accent>
          <CardTitle>Ce que nous récupérons</CardTitle>
          <CardBody>
            <ul className="text-ink space-y-1 text-sm">
              {CONSENT_COLLECTED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Said here rather than nowhere. An outing that comes through and
            validates nothing, with no explanation, is a message to support —
            and the participant is right to send it: from where they stand,
            the game simply did not react. */}
        <Card>
          <CardTitle>Les sorties saisies à la main</CardTitle>
          <CardBody>
            <p className="text-ink text-sm">
              Une sortie <strong>tapée à la main</strong> dans Strava ne valide
              aucun défi : le jeu repose sur ce qui a été enregistré. Une sortie{" "}
              <strong>importée depuis une montre</strong> — Garmin, Polar, Coros
              — compte normalement, c’est le cas le plus courant.
            </p>
            {manual > 0 && (
              <p className="text-ink-muted mt-2 text-sm">
                {manual} de vos sorties {manual > 1 ? "ont" : "a"} été saisie
                {manual > 1 ? "s" : ""} à la main. Elle{manual > 1 ? "s" : ""}{" "}
                figure{manual > 1 ? "nt" : ""} dans vos totaux personnels, mais
                n’{manual > 1 ? "ont" : "a"} validé aucun défi.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Ce que nous ne récupérons jamais</CardTitle>
          <CardBody>
            <ul className="text-ink space-y-1 text-sm">
              {CONSENT_NEVER_COLLECTED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-ink-muted mt-3 text-sm">
              Ce n’est pas une promesse : ces données n’ont aucune colonne où
              être écrites. Elles ne sont pas stockées, donc elles ne peuvent
              pas fuiter.
            </p>
          </CardBody>
        </Card>

        {/* Story 15.5. Le consentement de la story 3.2 autorise la
            récupération pour valider des défis ; les montrer aux autres est
            un traitement différent, et il doit être écrit là où la personne
            le lit. Le texte vient de `consent.ts` : la politique de
            confidentialité affiche le même, et un test les compare. */}
        <Card>
          <CardTitle>Ce que les autres participants voient</CardTitle>
          <CardBody>
            <p>{ACTIVITY_SHARING.rule}</p>

            <p className="text-ink mt-3 text-sm font-medium">
              Pour chaque sortie montrée
            </p>
            <ul className="text-ink space-y-1 text-sm">
              {ACTIVITY_SHARING.shown.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="text-ink mt-3 text-sm font-medium">Jamais montré</p>
            <ul className="text-ink space-y-1 text-sm">
              {ACTIVITY_SHARING.hidden.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Combien de temps, et comment effacer</CardTitle>
          <CardBody>
            <p className="text-ink text-sm">
              Vos activités sont conservées <strong>12 mois</strong> après la
              fin de l’édition, puis supprimées. Vous pouvez retirer votre
              autorisation à tout moment, et supprimer votre compte et toutes
              vos données depuis{" "}
              <Link
                href={ROUTES.account}
                className="underline underline-offset-4"
              >
                Mon compte
              </Link>
              .
            </p>
            <p className="text-ink-muted mt-3 text-sm">
              Strava est une société américaine. C’est précisément ce que cette
              autorisation encadre : sans elle, rien n’est demandé à Strava.
            </p>
          </CardBody>
        </Card>
      </div>

      {failure && (
        <div className="mt-8">
          <Alert tone="danger" title="La connexion n’a pas abouti">
            {FAILURES[failure] ?? FAILURES.echange}
          </Alert>
        </div>
      )}

      {query.connecte === "1" && (
        <div className="mt-8">
          <Alert tone="success" title="Compte Strava connecté">
            Vos prochaines sorties seront prises en compte automatiquement.
          </Alert>
        </div>
      )}

      <div className="mt-10">
        {consent.granted ? (
          <div className="space-y-4">
            <Alert tone="success" title="Autorisation donnée">
              Le {formatDate(consent.grantedAt)}. Vos sorties peuvent être
              récupérées pendant l’édition.
            </Alert>

            {connection ? (
              <Card accent={connection.status === "broken"}>
                <CardTitle>Compte Strava</CardTitle>
                <CardBody>
                  <p className="text-ink text-sm">
                    Connecté depuis le {formatDate(connection.connectedAt)} —
                    athlète {connection.providerAccountId}.
                  </p>

                  {/* The question this screen exists to answer without
                        anybody writing in: "is my run from this morning
                        counted?" (story 3.8 AC 1). */}
                  <p className="text-ink-muted mt-1 text-sm">
                    {connection.lastSyncedAt
                      ? `Dernière vérification le ${formatDateTime(connection.lastSyncedAt)}.`
                      : "Vos sorties n’ont pas encore été vérifiées."}
                  </p>

                  {/* Avant le premier jour, il n'y a rien à récupérer — et
                      sans le dire, une liaison qui marche ressemble à une
                      liaison en panne. C'est exactement le doute qui a
                      motivé cette phrase. */}
                  {!editionStarted && (
                    <p className="text-ink-muted mt-2 text-sm">
                      L’édition n’a pas encore commencé : rien n’est récupéré
                      avant le {formatDate(editionStart.toISOString())}. La
                      liaison, elle, est bien en place.
                    </p>
                  )}

                  {connection.status === "broken" && (
                    <>
                      <p className="text-danger mt-2 text-sm">
                        La liaison est rompue : Strava ne nous laisse plus
                        récupérer vos sorties. Cela arrive si vous avez retiré
                        l’autorisation depuis Strava. Vos défis déjà réussis
                        sont conservés.
                      </p>
                      {/* One tap back (story 3.7 AC 5). The reconnection
                            replaces the broken link rather than colliding
                            with it. */}
                      <p className="mt-3">
                        <Link
                          href="/api/activites/connexion/strava"
                          prefetch={false}
                          className={buttonClasses({ size: "md" })}
                        >
                          Reconnecter mon compte
                        </Link>
                      </p>
                    </>
                  )}

                  {connection.status === "active" && (
                    <>
                      <Resynchronise action={resynchronise} />
                      <Disconnect action={disconnectAccount} />
                    </>
                  )}
                </CardBody>
              </Card>
            ) : (
              <div>
                {/* A link, not a button: it is a navigation to a route that
                      redirects, and it works before any JavaScript has loaded.
                      The route re-checks the consent — hiding this link is a
                      courtesy, not a control. */}
                <Link
                  href="/api/activites/connexion/strava"
                  prefetch={false}
                  className={buttonClasses({ size: "lg" })}
                >
                  Connecter mon compte Strava
                </Link>
                <p className="text-ink-muted mt-2 text-sm">
                  Vous serez renvoyé vers Strava, qui vous demandera votre
                  accord, puis ramené ici.
                </p>
              </div>
            )}

            {/* On the same screen as granting, not buried three levels
                  down: a consent that is easy to give and hard to take back
                  is not a free consent. */}
            <WithdrawConsent action={withdrawActivityConsent} />
          </div>
        ) : (
          <div className="space-y-4">
            <Alert tone="info" title="Rien n’est récupéré pour l’instant">
              Tant que vous n’avez pas autorisé, aucune donnée sportive n’est
              demandée à Strava et aucun compte ne peut être connecté.
            </Alert>

            <ConsentForm action={grantActivityConsent} />
          </div>
        )}
      </div>
    </ParticipantShell>
  );
}

/**
 * Why a connection did not happen, said without jargon.
 *
 * Each one names something the participant can act on. "Une erreur est
 * survenue" would be true for all of them and useful for none — and the two
 * that are nobody's fault say so, rather than leaving somebody hunting for
 * what they did wrong.
 */
const FAILURES: Record<string, string> = {
  refus:
    "Vous n’avez pas autorisé Strava à partager vos activités. Vous pouvez réessayer quand vous voulez.",
  "deja-lie":
    "Ce compte Strava est déjà relié à un autre compte de jeu. Un compte Strava ne peut servir qu’à un seul participant.",
  etat: "La connexion a expiré ou a été interrompue. Relancez-la depuis cette page.",
  consentement:
    "Votre autorisation manque. Donnez-la ci-dessous, puis reconnectez votre compte.",
  session: "Votre session a expiré. Reconnectez-vous, puis réessayez.",
  injoignable:
    "Strava n’a pas répondu. Ce n’est pas de votre fait : réessayez dans quelques minutes.",
  configuration:
    "La connexion n’est pas encore configurée de notre côté. Prévenez l’organisation.",
  echange: "L’échange avec Strava a échoué. Relancez la connexion.",
  enregistrement:
    "Votre compte Strava a bien répondu, mais la liaison n’a pas pu être enregistrée. Réessayez.",
  inconnu: "Ce service sportif n’est pas reconnu.",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
