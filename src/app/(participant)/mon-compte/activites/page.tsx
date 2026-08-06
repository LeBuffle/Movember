import Link from "next/link";

import {
  ConsentForm,
  WithdrawConsent,
} from "@/components/activities/consent-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getOwnConnection } from "@/lib/activities/connection";
import {
  CONSENT_COLLECTED,
  CONSENT_NEVER_COLLECTED,
  getConsent,
} from "@/lib/activities/consent";
import {
  grantActivityConsent,
  withdrawActivityConsent,
} from "@/lib/activities/consent-actions";
import { ROUTES } from "@/lib/auth/routes";

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

  const [consent, connection] = await Promise.all([
    getConsent(),
    getOwnConnection(),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-ink-muted text-sm">
          <Link href={ROUTES.account} className="underline underline-offset-4">
            Mon compte
          </Link>
        </p>

        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Mes activités sportives
        </h1>

        <p className="text-ink-muted mt-3">
          Le jeu valide vos défis à partir de vos sorties enregistrées sur
          Strava. Voici exactement ce que cela veut dire.
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
                Strava est une société américaine. C’est précisément ce que
                cette autorisation encadre : sans elle, rien n’est demandé à
                Strava.
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
                <Card>
                  <CardTitle>Compte Strava</CardTitle>
                  <CardBody>
                    <p className="text-ink text-sm">
                      Connecté depuis le {formatDate(connection.connectedAt)} —
                      athlète {connection.providerAccountId}.
                    </p>
                    {connection.status === "broken" && (
                      <p className="text-danger mt-2 text-sm">
                        La liaison est rompue : reconnectez votre compte pour
                        que vos sorties recomptent.
                      </p>
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
      </main>

      <SiteFooter />
    </>
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
