import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UnsubscribeForm } from "@/components/notifications/unsubscribe-form";
import { Alert } from "@/components/ui/alert";
import { unsubscribeFromEmails } from "@/lib/notifications/unsubscribe-actions";

export const metadata = {
  title: "Ne plus recevoir d’e-mails — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The unsubscribe page, reachable without an account.
 *
 * **No session is read here, on purpose** (story 6.4 AC 4). Somebody who
 * wants the e-mails to stop is somebody who does not want to deal with us;
 * making them log in first is how an unsubscribe link becomes a spam report,
 * and a spam report costs the sending domain far more than one participant.
 *
 * The signed token in the address is the only proof, and it authorises
 * exactly one thing: switching off this person's e-mails.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.jeton;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Ne plus recevoir d’e-mails
        </h1>

        {token ? (
          <>
            <p className="text-ink-muted">
              Vous ne recevrez plus d’e-mails du jeu — ni le défi du jour, ni
              les annonces. Votre inscription et votre progression ne changent
              pas.
            </p>

            <UnsubscribeForm action={unsubscribeFromEmails} token={token} />
          </>
        ) : (
          <Alert tone="warning" title="Lien incomplet">
            Ce lien ne contient pas ce qu’il faut pour vous identifier. Ouvrez{" "}
            <Link
              href="/mon-compte/notifications"
              className="underline underline-offset-4"
            >
              « Mes notifications »
            </Link>{" "}
            depuis votre compte pour couper les e-mails.
          </Alert>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
