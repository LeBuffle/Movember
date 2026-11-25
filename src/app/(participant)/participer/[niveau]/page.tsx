import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TaxNotice } from "@/components/marketing/tax-notice";
import { ConsentForm } from "@/components/registration/consent-form";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { startRegistration } from "@/lib/registration/actions";
import { formatEuros, getTierBySlug } from "@/lib/registration/tiers";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Confirmer votre inscription — DEFI Movember",
  robots: { index: false, follow: false },
};

/** Reads the tier and the participant's state on every request. */
export const dynamic = "force-dynamic";

/**
 * The last screen before paying.
 *
 * Its job is to leave no surprise: what is being bought, for how much, how
 * much of it reaches the cause, and what this payment is not. Everything
 * shown here is read from the database — nothing is carried over from the
 * previous page, where it could have been altered.
 */
export default async function ParticipatePage({
  params,
}: {
  params: Promise<{ niveau: string }>;
}) {
  const { niveau } = await params;
  const tier = await getTierBySlug(niveau);

  if (!tier) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects, but a page must never depend on it
  // alone: a change to its matcher would silently expose this one.
  if (!user) {
    redirect(`${ROUTES.signIn}?suite=${ROUTES.participate}/${niveau}`);
  }

  // Already a participant: nothing to buy. Sent back to their account rather
  // than shown an error — they have done nothing wrong (AC 7).
  const { data: registration } = await supabase
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (registration?.status === "active") {
    redirect(ROUTES.account);
  }

  return (
    <>
      <SiteHeader />

      <main id="contenu" className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-ink-muted text-sm">
          <Link href="/" className="underline underline-offset-4">
            ← Changer de niveau
          </Link>
        </p>

        <h1 className="text-ink mt-4 text-3xl font-bold tracking-tight">
          Confirmer votre inscription
        </h1>
        <p className="text-ink-muted mt-2">
          Édition {EDITION_YEAR} du DEFI Movember.
        </p>

        <Card accent className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-ink text-xl font-bold">{tier.name}</h2>
            <p className="text-ink text-3xl font-extrabold tracking-tight">
              {formatEuros(tier.priceCents)}
            </p>
          </div>

          <p className="text-brand-orange-ink mt-1 text-sm font-semibold">
            {tier.donatedCents === tier.priceCents
              ? `${formatEuros(tier.donatedCents)} reversés à la fondation Movember`
              : `dont ${formatEuros(tier.donatedCents)} reversés à la fondation Movember`}
          </p>

          <ul className="text-ink-muted mt-4 space-y-2 text-sm">
            {tier.perks.map((perk) => (
              <li key={perk} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="text-brand-orange font-bold"
                >
                  ✓
                </span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Repeated here, immediately before payment, and not because the
            home page already says it — because `CLAUDE.md` §6 asks for it to
            be unmissable at the moment money changes hands. */}
        <TaxNotice className="mt-6" />

        <div className="mt-8">
          <ConsentForm action={startRegistration} tierSlug={tier.slug} />
        </div>

        <p className="text-ink-muted mt-6 text-sm">
          Le paiement est traité par Stripe. Aucune donnée de votre carte n’est
          transmise à l’association ni conservée par l’application.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
