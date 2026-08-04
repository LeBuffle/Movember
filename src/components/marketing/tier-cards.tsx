import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatEuros, type RegistrationTier } from "@/lib/registration/tiers";

/**
 * The three registration tiers.
 *
 * Two things are being weighed against each other here. The visitor has to
 * see what they get for their money, and they have to see what actually
 * reaches the cause. Showing the donated amount on every tier — including
 * where it is well under the price — is the honest way to do it, and it is
 * what makes the tax notice next to these cards make sense.
 *
 * The wording is "12 € reversés", never "100 %". On a 12 € payment the
 * processor takes about 43 centimes; whether the association absorbs that is
 * decision P2 and is not settled. The figure stated is the association's
 * commitment, and it is true either way.
 */
function TierCard({ tier }: { tier: RegistrationTier }) {
  return (
    <li
      className={cn(
        "bg-surface flex flex-col rounded-xl border p-6",
        tier.featured ? "border-brand-blue border-2 shadow-sm" : "border-line",
      )}
    >
      {/* Above the title rather than beside it: side by side, the badge eats
          the width and breaks "Sportif chevronné" across two lines, which
          makes the featured card the ugliest of the three. */}
      <div className="min-h-6">
        {tier.featured && <Badge tone="blue">Le plus choisi</Badge>}
      </div>

      <h3 className="text-ink mt-3 text-xl font-bold">{tier.name}</h3>
      <p className="text-ink-muted mt-1 text-sm">{tier.tagline}</p>

      <p className="mt-4">
        <span className="text-ink text-4xl font-extrabold tracking-tight">
          {formatEuros(tier.priceCents)}
        </span>
      </p>

      <p className="text-brand-orange-ink mt-1 text-sm font-semibold">
        {/* "dont 12 € sur 12 €" reads as a subset of itself. Saying
            "intégralement" would be the natural fix and is exactly what
            decision P2 forbids until the payment fee is settled — so the
            sentence is simply built without "dont". */}
        {tier.donatedCents === tier.priceCents
          ? `${formatEuros(tier.donatedCents)} reversés à la fondation Movember`
          : `dont ${formatEuros(tier.donatedCents)} reversés à la fondation Movember`}
      </p>

      <ul className="text-ink-muted mt-5 flex-1 space-y-2 text-sm">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex gap-2">
            {/* Decorative: the list already conveys the structure, and a
                repeated "check mark" read aloud on every line is noise. */}
            <span aria-hidden="true" className="text-brand-orange font-bold">
              ✓
            </span>
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={tier.featured ? "secondary" : "ghost"}
        size="lg"
        disabled
        className="mt-6 w-full"
      >
        Bientôt disponible
      </Button>
    </li>
  );
}

export function TierCards({ tiers }: { tiers: RegistrationTier[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => (
        <TierCard key={tier.slug} tier={tier} />
      ))}
    </ul>
  );
}
