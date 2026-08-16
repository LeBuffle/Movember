import Link from "next/link";
import { notFound } from "next/navigation";

import { SendDuelForm } from "@/components/duels/send-duel-form";
import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { sendDuelAction } from "@/lib/duels/actions";
import { getDuelTypes } from "@/lib/duels/catalogue";
import { ownWallet } from "@/lib/duels/wallet";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Défier un participant — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Choosing what to send, and to whom (story 12.3).
 *
 * **Reached from the ranking**, which is where somebody decides they want to
 * challenge a particular person. The target travels in the address bar, so the
 * page can be opened again, sent as a link, and left with the back button.
 *
 * Every refusal is checked again on the server when the form is submitted. The
 * checks made here are for the screen: telling somebody *before* they choose
 * that this person does not accept duels is worth more than refusing after.
 */
export default async function SendDuelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const receiverId =
    (Array.isArray(params.joueur) ? params.joueur[0] : params.joueur) ?? "";
  const riposteOf =
    (Array.isArray(params.riposte) ? params.riposte[0] : params.riposte) ??
    null;

  if (!receiverId) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Read from the public view, never from `profiles`: asking the table for a
  // pseudonym would hand over the e-mail address in the same query.
  const { data: receiver } = await supabase
    .from("public_profiles")
    .select("id, display_name, duels_opt_out")
    .eq("id", receiverId)
    .maybeSingle();

  if (!receiver) notFound();

  const [types, wallet] = await Promise.all([getDuelTypes(), ownWallet(1)]);

  const isSelf = user?.id === receiver.id;

  return (
    <ParticipantShell
      title={`Défier ${receiver.display_name}`}
      intro="Il aura 24 heures pour le relever, à compter de l’envoi."
    >
      {isSelf ? (
        <Alert tone="info" title="C’est vous">
          <p>
            On ne peut pas se défier soi-même. Choisissez quelqu’un d’autre.
          </p>
          <p className="mt-3">
            <Link
              href="/jeu/classement"
              className={buttonClasses({ size: "sm" })}
            >
              Retour au classement
            </Link>
          </p>
        </Alert>
      ) : receiver.duels_opt_out ? (
        <Alert tone="info" title="Ce participant ne reçoit pas de défis">
          <p>
            Il a coupé la réception dans ses réglages. Rien ne lui sera envoyé,
            et aucun crédit ne sera utilisé.
          </p>
          <p className="mt-3">
            <Link
              href="/jeu/classement"
              className={buttonClasses({ size: "sm" })}
            >
              Choisir quelqu’un d’autre
            </Link>
          </p>
        </Alert>
      ) : types.length === 0 ? (
        <Alert tone="info" title="Aucun défi disponible">
          Les défis entre joueurs ne sont pas ouverts pour le moment.
        </Alert>
      ) : (
        <>
          {/* Said before the choice, not after: somebody with no credit needs
              a way forward, not a refusal at the end of a form (AC 4). */}
          {riposteOf ? (
            <Alert tone="success" title="Riposte gratuite">
              Vous avez relevé son défi : celui-ci ne vous coûte aucun crédit.
            </Alert>
          ) : wallet.balance < 1 ? (
            <Alert tone="warning" title="Il vous faut un crédit">
              <p>
                Envoyer un défi utilise un crédit, et votre solde est vide. Les
                crédits s’achètent par lot — c’est ce qui évite de laisser 14 %
                du montant en frais bancaires.
              </p>
              <p className="mt-3">
                <Link
                  href="/jeu/defis-joueurs/credits"
                  className={buttonClasses({ size: "sm" })}
                >
                  Acheter des crédits
                </Link>
              </p>
            </Alert>
          ) : (
            <p className="text-ink-muted text-sm">
              Solde : {wallet.balance} crédit{wallet.balance > 1 ? "s" : ""}.
              Cet envoi en utilisera un.
            </p>
          )}

          <Card>
            <CardBody>
              <SendDuelForm
                action={sendDuelAction}
                types={types}
                receiverId={receiver.id}
                receiverName={receiver.display_name}
                riposteOf={riposteOf}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Ce qui se passe ensuite</CardTitle>
              <ul className="text-ink-muted mt-2 space-y-1 text-sm">
                <li>Il est prévenu tout de suite, et a 24 heures.</li>
                <li>
                  Seule une sortie <strong>commencée après votre envoi</strong>{" "}
                  peut valider le défi.
                </li>
                <li>
                  S’il le relève, il pourra vous riposter gratuitement. S’il ne
                  le relève pas, il ne perd rien — et vous recevrez un message.
                </li>
                <li>Aucun point, aucune carte : ni pour lui, ni pour vous.</li>
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </ParticipantShell>
  );
}
