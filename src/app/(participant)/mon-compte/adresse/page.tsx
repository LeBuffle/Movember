import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AddressForm } from "@/components/shipping/address-form";
import { Alert } from "@/components/ui/alert";
import { ROUTES } from "@/lib/auth/routes";
import { saveShippingAddress } from "@/lib/shipping/actions";
import { getShippingContext } from "@/lib/shipping/address";

export const metadata = {
  title: "Adresse de livraison — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ShippingAddressPage() {
  const context = await getShippingContext();

  // Nothing to post: the page has no reason to exist for this participant,
  // and showing an empty address form would suggest they are owed something.
  if (!context.required) {
    redirect(ROUTES.account);
  }

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
          Où envoyer votre médaille
        </h1>

        <p className="text-ink-muted mt-3">
          Votre niveau <strong>{context.tierName}</strong> comprend un envoi
          postal. Les colis partent à la fin du défi, en décembre — vous pouvez
          corriger cette adresse jusque-là.
        </p>

        <div className="mt-8">
          <AddressForm action={saveShippingAddress} address={context.address} />
        </div>

        <div className="mt-10">
          <Alert tone="info" title="Ce que nous faisons de cette adresse">
            Elle sert uniquement à vous envoyer votre contrepartie. Elle n’est
            visible que de vous et des organisateurs, elle n’apparaît sur aucun
            classement, et elle est supprimée avec votre compte.
          </Alert>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
