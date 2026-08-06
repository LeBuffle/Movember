import { BroadcastForm } from "@/components/admin/broadcast-form";
import { Alert } from "@/components/ui/alert";
import { AUDIENCES } from "@/lib/notifications/audience";
import { audienceMembers } from "@/lib/notifications/broadcast";
import { sendBroadcast } from "@/lib/notifications/broadcast-actions";
import { pushSendConfigured } from "@/lib/notifications/send";

export const metadata = {
  title: "Notifications — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Writing to the participants, without a developer.
 *
 * The screen that makes the month animatable by the team itself: "sending a
 * notification must be a form to fill in, never a deployment" (PRD §2).
 *
 * The recipient counts are computed here, on the server, from the same query
 * the send will use. A count read from somewhere else could disagree with
 * what actually goes out — and this is the one screen where that number is
 * the safeguard.
 */
export default async function AdminNotificationsPage() {
  const counts = Object.fromEntries(
    await Promise.all(
      AUDIENCES.map(async (audience) => [
        audience.value,
        (await audienceMembers(audience.value)).length,
      ]),
    ),
  ) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Notifications
        </h1>
        <p className="text-ink-muted mt-2">
          Un message à tous les participants, ou à une partie d’entre eux. Il
          part immédiatement, et ne peut pas être annulé.
        </p>
      </div>

      {!pushSendConfigured() && (
        <Alert tone="warning" title="Les notifications ne sont pas configurées">
          Les clés d’envoi manquent sur ce serveur. Un message écrit ici
          n’arriverait sur aucun téléphone — seuls les e-mails partiraient, et
          uniquement si le service d’e-mail est configuré.
        </Alert>
      )}

      <Alert tone="info" title="Ce que les participants recevront">
        Chacun reçoit par le moyen qui le concerne : une notification sur son
        téléphone s’il en a activé, un e-mail sinon. Et les préférences de
        chacun sont respectées — quelqu’un qui a coupé les annonces ne recevra
        rien.
      </Alert>

      <BroadcastForm
        action={sendBroadcast}
        /* Generated once per page load, and carried by the form. A double
           press or a back button reuses it, and the send is refused rather
           than duplicated (story 6.8 AC 6). */
        messageId={crypto.randomUUID()}
        counts={counts}
      />
    </div>
  );
}
