import "server-only";

import { sendEmail } from "@/lib/email/client";
import { welcomeEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The welcome e-mail (story 2.5).
 *
 * **It never fails an activation.** Somebody who has paid is in the game
 * whatever happens to their e-mail — the send is attempted after the
 * registration is already active, and its outcome only reaches the log. A
 * confirmation that could block an activation would turn a mail provider's bad
 * afternoon into a participant locked out.
 *
 * **Sent once, and the database is what says so.** The webhook can be
 * delivered twice, and two processes can handle the same event at the same
 * moment. A check in the application would be passed by both. The claim below
 * is a conditional update: only the pass that actually changes the row sends
 * anything.
 *
 * **A failed send releases the claim.** Otherwise the mark would say "sent"
 * about an e-mail that never left, and nothing would ever come back for it.
 * The narrow window that remains — a crash between the claim and the send —
 * costs a welcome e-mail, not a registration.
 */

export type WelcomeOutcome =
  | { sent: true }
  | {
      sent: false;
      reason: "already-sent" | "no-address" | "unconfigured" | "failed";
    };

type Row = {
  profile_id: string;
  registration_tiers: { name: string } | null;
  profiles: { email: string | null } | null;
};

export async function sendWelcomeEmail(
  registrationId: string,
): Promise<WelcomeOutcome> {
  const admin = createAdminClient();

  /* The claim first, before anything is read or built. `.is(..., null)` is
     the whole guarantee: a second delivery updates no row, gets an empty
     result, and stops here. */
  const { data: claimed, error: claimError } = await admin
    .from("registrations")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("status", "active")
    .is("welcome_email_sent_at", null)
    .select("id");

  if (claimError) {
    console.error("[bienvenue] marque non posée", { code: claimError.code });
    return { sent: false, reason: "failed" };
  }

  if ((claimed ?? []).length === 0)
    return { sent: false, reason: "already-sent" };

  const release = async () => {
    await admin
      .from("registrations")
      .update({ welcome_email_sent_at: null })
      .eq("id", registrationId);
  };

  const { data } = await admin
    .from("registrations")
    .select("profile_id, registration_tiers (name), profiles (email)")
    .eq("id", registrationId)
    .maybeSingle();

  const row = data as unknown as Row | null;

  // The amounts come from the payment line, not from the price list: the
  // e-mail states what was actually charged and actually committed, which is
  // what the participant will compare against their bank statement.
  const { data: payment } = await admin
    .from("payments")
    .select("gross_cents, donation_cents")
    .eq("registration_id", registrationId)
    .eq("kind", "registration")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const address = row?.profiles?.email?.trim();

  if (!row || !payment || !address) {
    // Nothing to send to, or nothing to say. Releasing the claim so a later
    // pass — once the accounting line exists — can do it properly.
    await release();
    console.warn("[bienvenue] envoi impossible", {
      registration: registrationId,
      hasRow: Boolean(row),
      hasPayment: Boolean(payment),
      hasAddress: Boolean(address),
    });
    return { sent: false, reason: "no-address" };
  }

  const content = welcomeEmail({
    tierName: row.registration_tiers?.name ?? "Inscription",
    grossCents: payment.gross_cents,
    donationCents: payment.donation_cents,
    gameUrl: absoluteUrl("/jeu"),
  });

  const outcome = await sendEmail({
    to: address,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!outcome.ok) {
    await release();

    if (outcome.reason === "unconfigured") {
      // The normal state until the Resend account is wired up. Not an error,
      // and it must not read like one in the logs for months.
      console.info("[bienvenue] service d’envoi non configuré", {
        registration: registrationId,
      });
      return { sent: false, reason: "unconfigured" };
    }

    console.error("[bienvenue] envoi refusé", {
      registration: registrationId,
      reason: outcome.reason,
    });
    return { sent: false, reason: "failed" };
  }

  console.info("[bienvenue] e-mail envoyé", { registration: registrationId });

  return { sent: true };
}
