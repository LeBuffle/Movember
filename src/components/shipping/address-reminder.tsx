import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { formatAddress, type ShippingContext } from "@/lib/shipping/address";

/**
 * The nudge, and only a nudge.
 *
 * A participant without an address plays normally (AC 4). The medal is a
 * counterpart, not an entry ticket, and holding the game back over a postcode
 * would be out of all proportion — so this asks, in the places the person
 * already visits, and never blocks anything.
 *
 * Shown only to those who actually have something coming: asking everyone
 * would be collecting addresses we have no use for, which is precisely what
 * data minimisation forbids.
 */
export function AddressReminder({ context }: { context: ShippingContext }) {
  if (!context.required) return null;

  if (!context.address) {
    return (
      <Alert tone="warning" title="Il nous manque votre adresse">
        Votre niveau {context.tierName} comprend un envoi postal, et nous ne
        savons pas encore où l’adresser. Rien ne presse — les colis partent en
        décembre — mais autant le faire maintenant.
        <p className="mt-3">
          <Link
            href="/mon-compte/adresse"
            className={buttonClasses({ size: "sm" })}
          >
            Renseigner mon adresse
          </Link>
        </p>
      </Alert>
    );
  }

  return (
    <div className="border-line bg-surface rounded-xl border p-4">
      <p className="text-ink font-semibold">Adresse de livraison</p>
      <p className="text-ink-muted mt-1 text-sm">
        {formatAddress(context.address)}
      </p>
      <p className="mt-2 text-sm">
        <Link
          href="/mon-compte/adresse"
          className="text-brand-blue underline underline-offset-4"
        >
          Corriger
        </Link>
      </p>
    </div>
  );
}
