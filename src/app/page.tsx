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
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { getRegistrationTiers } from "@/lib/registration/tiers";

export const metadata: Metadata = {
  title: "DEFI Movember — un mois, un défi par jour",
  description:
    "Un défi sportif par jour pendant tout novembre, une collection de cartes à compléter, " +
    "et une inscription reversée à la fondation Movember. Projet indépendant porté par une " +
    "association loi 1901.",
};

/**
 * Regenerated at most every five minutes.
 *
 * The prices now come from the database (story 2.1), and a page that queried
 * it on every visit would be the slowest page of the site — the one a share
 * leads to, opened on a phone. Five minutes is short enough that a price
 * corrected during the registration rush is live almost at once, and long
 * enough that a thousand visitors cost one query.
 */
export const revalidate = 300;

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
 * Statically rendered, with no request to the database. Everything shown
 * comes from `lib/edition/calendar.ts` and `lib/registration/tiers.ts`,
 * which epic 2 rewires to Supabase once there is something real to count.
 */
export default async function Home() {
  const tiers = await getRegistrationTiers();

  return (
    <>
      <SiteHeader />

      <main>
        {/* --- Accroche ------------------------------------------------- */}
        <section className="mx-auto max-w-3xl px-4 pt-12 pb-14 sm:pt-16">
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

          <div className="mt-8">
            <Alert tone="info" title="Les inscriptions ne sont pas ouvertes">
              Elles ouvriront à la mi-octobre {EDITION_YEAR}. Le jeu commence le
              1ᵉʳ novembre.
            </Alert>
          </div>
        </section>

        {/* --- Règle du jeu --------------------------------------------- */}
        <div className="bg-surface-sunken border-line border-y">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <HowItWorks />
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
            {/* No fallback price list, on purpose: showing one price while
                the payment charges another is the worst failure this page
                can have. Nothing beats a wrong amount for losing someone's
                trust in a fundraiser. */}
            {tiers.length > 0 ? (
              <TierCards tiers={tiers} />
            ) : (
              <Alert tone="warning" title="Tarifs momentanément indisponibles">
                Les niveaux d’inscription ne peuvent pas être affichés pour le
                moment. Réessayez dans quelques minutes — le reste du site
                fonctionne normalement.
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
            <CollectiveFigures />
          </div>
        </div>

        {/* --- Calendrier ------------------------------------------------- */}
        <div className="mx-auto max-w-3xl px-4 py-14">
          <EditionCalendar />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
