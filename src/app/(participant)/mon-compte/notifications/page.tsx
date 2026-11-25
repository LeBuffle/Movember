import Link from "next/link";
import { redirect } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { PushPermission } from "@/components/notifications/push-permission";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import {
  forgetPushSubscription,
  registerPushSubscription,
} from "@/lib/notifications/actions";
import { saveNotificationPreferences } from "@/lib/notifications/preference-actions";
import { ownPreferences } from "@/lib/notifications/preferences";
import { ownSubscriptions } from "@/lib/notifications/subscriptions";
import { vapidPublicKey } from "@/lib/notifications/vapid";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Mes notifications — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a participant turns notifications on.
 *
 * Deliberately a page of its own rather than a card on "Mon compte": the
 * permission prompt is the one gesture in the application that cannot be
 * retried once refused, so it deserves a screen that explains before it asks.
 *
 * The per-category preferences arrive with story 6.7. This screen is the
 * on-off switch and the list of devices — nothing more, so that nothing here
 * has to be undone when the preferences land.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects. Checked again here on purpose: a page
  // must never depend on middleware alone, or a matcher change exposes it.
  if (!user) redirect(ROUTES.signIn);

  const [devices, preferences] = await Promise.all([
    ownSubscriptions(),
    ownPreferences(),
  ]);

  return (
    <ParticipantShell title="Mes notifications" eyebrow="Mon compte">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/mon-compte" className="underline underline-offset-4">
            Mon compte
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Mes notifications
        </h1>
      </div>

      <Card>
        <CardTitle>Le rappel du jour</CardTitle>
        <CardBody>
          <p>
            Chaque matin, votre défi. Puis, dans la journée, un message quand
            une de vos sorties le valide et qu’une carte vous revient.
          </p>
          <p className="mt-2 text-sm">
            Vous choisissez plus bas ce dont vous voulez être prévenu. Sans
            notification, l’essentiel vous arrivera par e-mail.
          </p>

          <div className="mt-4">
            <PushPermission
              publicKey={vapidPublicKey()}
              subscribed={devices.length > 0}
              register={registerPushSubscription}
              forget={forgetPushSubscription}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Ce dont je veux être prévenu</CardTitle>
        <CardBody>
          <p className="text-sm">
            Couper une catégorie ne coupe que celle-là. Vous pouvez garder le
            défi du jour et ne plus rien recevoir d’autre.
          </p>

          <div className="mt-4">
            <PreferencesForm
              action={saveNotificationPreferences}
              preferences={preferences}
            />
          </div>
        </CardBody>
      </Card>

      {devices.length > 0 && (
        <Card>
          <CardTitle>
            {devices.length > 1
              ? `${devices.length} appareils reliés`
              : "Un appareil relié"}
          </CardTitle>
          <CardBody>
            <p className="text-sm">
              Vous recevez sur chacun d’eux. Le bouton ci-dessus ne retire que
              l’appareil sur lequel vous êtes.
            </p>

            <ul className="border-line divide-line mt-3 divide-y border-y text-sm">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span className="text-ink">{describe(device.userAgent)}</span>
                  <span className="text-ink-muted">
                    depuis le {formatDate(device.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </ParticipantShell>
  );
}

/**
 * A device, in words somebody recognises.
 *
 * A user-agent string is unreadable, and the only question this list answers
 * is "which of my devices is that". Three families are enough to answer it;
 * anything finer would be guesswork dressed as information.
 */
function describe(userAgent: string | null): string {
  if (!userAgent) return "Appareil inconnu";

  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone ou iPad";
  if (/Android/i.test(userAgent)) return "Téléphone Android";

  return "Ordinateur";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
