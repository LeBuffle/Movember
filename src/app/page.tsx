import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CollectiveFigures } from "@/components/marketing/collective-figures";
import { EditionCalendar } from "@/components/marketing/edition-calendar";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { TaxNotice } from "@/components/marketing/tax-notice";
import { TierCards } from "@/components/marketing/tier-cards";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { getPublicTiers, getPublicTotals } from "@/lib/public-cache";

export const metadata: Metadata = {
  title: "DEFI Movember — un mois, un défi par jour",
  description:
    "Un défi sportif par jour pendant tout novembre, une collection de cartes à compléter, " +
    "et une inscription reversée à la fondation Movember. Projet indépendant porté par une " +
    "association loi 1901.",
};

/**
 * Rendered per request, with the queries behind it cached for five minutes.
 *
 * **Not `revalidate`.** That made Next.js prerender this page during `docker
 * build`, in a container with no database credentials — so every image
 * shipped a home page with no prices and a counter that said it was being
 * prepared, and it stayed that way until five minutes and two visits had
 * gone by. See `lib/public-cache.ts`.
 *
 * Rendering costs a few milliseconds; the queries are what cost, and those
 * are cached. A thousand visitors still make one round trip per five
 * minutes — the property `revalidate` was chosen for in the first place.
 */
export const dynamic = "force-dynamic";

/**
 * Public home page.
 *
 * The one page a share leads to, and the only one most visitors will read.
 * It has under a minute to convey five things: the cause, the rules, the
 * price, what you get, and — this one is an obligation rather than a
 * argument — that none of it is a tax-deductible donation.
 *
 * Order is deliberate. The tax notice sits directly above the prices, not
 * below them and not in the footer: someone who reads the amounts must have
 * read what those amounts are (AC 3). Story 1.9 could have satisfied the
 * letter of that criterion with a line in the footer; it would have missed
 * the point of `CLAUDE.md` §6.
 *
 * Regenerated on a timer rather than rendered per visit. The prices come from
 * the database (story 2.1) and the collective counters from the rankings
 * (story 7.7); both are read with the anonymous client, which reads no cookie
 * — that is what keeps this page cacheable, and it is the page a share leads
 * to, opened on a phone.
 */
export default async function Home() {
  const [tiers, live] = await Promise.all([
    getPublicTiers(),
    getPublicTotals(),
  ]);

  return (
    <>
      <SiteHeader />

      <main id="contenu">
        {/* --- Accroche : la seule chose que cette page a à faire ------- */}
        <section className="bg-brand-blue-soft border-line border-b">
          <div className="mx-auto max-w-3xl px-4 pt-12 pb-14 sm:pt-16">
            <p className="text-brand-orange-ink text-sm font-semibold tracking-widest uppercase">
              Novembre {EDITION_YEAR}
            </p>

            <h1 className="text-ink mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Un mois, un défi par jour,
              <br />
              une collection à compléter.
            </h1>

            <p className="text-ink-muted mt-5 text-lg">
              Vous faites déjà du sport. Reliez votre compte Strava, relevez le
              défi du jour, gagnez des cartes moustachues — et faites avancer la
              lutte contre les cancers masculins et le mal-être des hommes.
            </p>

            {/* One button. The page has one job.

                The gallery link used to sit here and no longer does: what
                there is to collect matters during the game, not at the moment
                somebody decides whether to join. A second button next to the
                first halves the first one. */}
            {tiers.length > 0 ? (
              <div className="mt-8">
                <Link
                  href="#tarifs"
                  className={buttonClasses({
                    size: "lg",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Je participe
                </Link>

                <p className="text-ink-muted mt-3 text-sm">
                  Trois formules, à partir de{" "}
                  {(
                    Math.min(...tiers.map((tier) => tier.priceCents)) / 100
                  ).toLocaleString("fr-FR")}
                  €. Le compte se crée après le choix.
                </p>
              </div>
            ) : (
              <div className="mt-8">
                <Alert
                  tone="info"
                  title="Les inscriptions ne sont pas ouvertes"
                >
                  Elles ouvriront à la mi-octobre {EDITION_YEAR}. Le jeu
                  commence le 1ᵉʳ novembre.
                </Alert>
              </div>
            )}

            {/* As visible as the main action, and deliberately so. Somebody
                who registered last week and comes back is not a lost cause to
                be nudged towards signing up again — they are the person this
                whole funnel already convinced. */}
            <div className="border-line mt-8 border-t pt-5">
              <p className="text-ink font-semibold">
                Vous avez déjà un compte ?
              </p>
              <p className="mt-2">
                <Link
                  href="/connexion"
                  className={buttonClasses({
                    variant: "secondary",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Me connecter
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* --- Pourquoi ------------------------------------------------- */}
        <section
          aria-labelledby="pourquoi"
          className="mx-auto max-w-3xl px-4 py-14"
        >
          <h2 id="pourquoi" className="text-ink text-2xl font-bold sm:text-3xl">
            Pourquoi participer
          </h2>

          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-ink font-semibold">
                Parce que la cause est réelle
              </h3>
              <p className="text-ink-muted mt-1">
                Cancers masculins, santé mentale, prévention. Votre inscription
                est reversée à la fondation Movember par l’association, et le
                montant sur lequel elle s’engage est écrit en face de chaque
                formule.
              </p>
            </div>

            <div>
              <h3 className="text-ink font-semibold">
                Parce que ça ne demande rien de plus
              </h3>
              <p className="text-ink-muted mt-1">
                Vous courez, roulez ou nagez déjà. Vos sorties remontent toutes
                seules depuis Strava et valident vos défis sans que vous ayez
                quoi que ce soit à déclarer.
              </p>
            </div>

            <div>
              <h3 className="text-ink font-semibold">
                Parce qu’un mois, ça se tient à plusieurs
              </h3>
              <p className="text-ink-muted mt-1">
                Sept classements, des équipes, une collection de cartes à
                compléter. De quoi ressortir le neuvième jour, celui où on
                arrête d’habitude.
              </p>
            </div>
          </div>
        </section>

        {/* --- Comment -------------------------------------------------- */}
        <div className="bg-surface-sunken border-line border-y">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <HowItWorks />

            {/* A discreet link, and no longer a button in the hero. What
                there is to collect is an argument (story 5.8), but it is an
                argument for somebody already reading the rules — not a
                second call to action competing with the only one that
                matters. */}
            <p className="text-ink-muted mt-8 text-sm">
              Curieux de ce qu’il y a à collectionner ?{" "}
              <Link
                href="/cartes"
                className="text-brand-blue font-semibold underline underline-offset-4"
              >
                Voir les cartes
              </Link>
            </p>
          </div>
        </div>

        {/* --- Tarifs, précédés de la mention fiscale -------------------- */}
        <section
          aria-labelledby="tarifs"
          className="mx-auto max-w-5xl px-4 py-14"
        >
          <h2 id="tarifs" className="text-ink text-2xl font-bold sm:text-3xl">
            Trois façons de participer
          </h2>
          <p className="text-ink-muted mt-2">
            L’inscription finance la collecte. Le jeu est le même pour tout le
            monde : aucun défi, aucun classement ne s’achète.
          </p>

          <TaxNotice className="mt-6" />

          <div className="mt-8">
            {/* The failure message deliberately does not promise that
                waiting helps. The first time it appeared it was not a
                passing incident but a configuration state — an edition still
                in draft — and "réessayez dans quelques minutes" sent
                somebody waiting for something that was never going to
                resolve on its own.

                No fallback price list, on purpose: showing one price while
                the payment charges another is the worst failure this page
                can have. Nothing beats a wrong amount for losing someone's
                trust in a fundraiser. */}
            {tiers.length > 0 ? (
              <TierCards tiers={tiers} />
            ) : (
              <Alert tone="warning" title="Tarifs indisponibles">
                Les niveaux d’inscription ne peuvent pas être affichés. Le reste
                du site fonctionne normalement — prévenez l’organisation si cela
                dure.
              </Alert>
            )}
          </div>

          {tiers.length > 0 && (
            <p className="text-ink-muted mt-6 text-sm">
              Les montants reversés sont ceux sur lesquels l’association
              s’engage ; le reste couvre la médaille et les cartes. Les
              conditions complètes figurent dans les{" "}
              <Link href="/cgv" className="underline underline-offset-4">
                conditions générales de vente
              </Link>
              .
            </p>
          )}
        </section>

        {/* --- Chiffres --------------------------------------------------- */}
        <div className="bg-surface-sunken border-line border-y">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <CollectiveFigures live={live} />
          </div>
        </div>

        {/* --- Calendrier ------------------------------------------------- */}
        <div className="mx-auto max-w-3xl px-4 py-14">
          <EditionCalendar />
        </div>

        {/* The last thing on the page is the same thing as the first. A
            visitor who read to the bottom is the one most likely to join,
            and asking them to scroll back up is asking them to leave. */}
        {tiers.length > 0 && (
          <div className="border-line bg-brand-blue-soft border-t">
            <div className="mx-auto max-w-3xl px-4 py-12 text-center">
              <p className="text-ink text-xl font-bold">
                Prêt à relever le défi ?
              </p>
              <p className="text-ink-muted mt-2">
                Trois formules, une inscription, un mois de novembre.
              </p>
              <p className="mt-5">
                <Link
                  href="#tarifs"
                  className={buttonClasses({
                    size: "lg",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Je participe
                </Link>
              </p>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
