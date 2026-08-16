"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { TERMS_VERSION } from "@/lib/legal/notices";
import { createCheckoutSession } from "@/lib/registration/checkout";
import {
  getTierById,
  getTierBySlug,
  type RegistrationTier,
} from "@/lib/registration/tiers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RegistrationFormState = {
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Where to send someone once the intention to pay is recorded.
 *
 * Never returns an error to the form, and that is deliberate: by the time
 * this runs, the `pending` registration exists. Sending them back to the
 * consent form would suggest nothing was saved, and they would tick the two
 * boxes again for nothing. The return page reads the registration and says
 * plainly where things stand — including "le paiement n'est pas encore
 * ouvert", which is the expected state until the keys are in place.
 */
async function paymentHandoff(args: {
  registrationId: string;
  profileId: string;
  editionId: string;
  tier: RegistrationTier;
  email?: string;
}): Promise<string> {
  const outcome = await createCheckoutSession(args);

  if (outcome.ok) return outcome.url;

  const statut =
    outcome.reason === "stripe-unavailable" ? "indisponible" : "echec";

  return `${ROUTES.participate}/${args.tier.slug}/paiement?statut=${statut}`;
}

/**
 * Records a participant's choice of tier and their acceptance of the terms,
 * then hands over to payment.
 *
 * **This is the one place in the application where a participant's action
 * writes to `registrations`, and it does so with the service key.** That
 * deserves the care below, because the service key bypasses row level
 * security entirely — the protection that exists precisely to stop someone
 * enrolling without paying (story 2.1).
 *
 * Three rules follow from that.
 *
 * 1. **The identity comes from the session, never from the form.**
 *    `profile_id` is read from `getUser()`. Nothing submitted by the browser
 *    can name someone else.
 * 2. **The amount comes from the database, never from the form.** The
 *    browser sends a slug; the price is looked up. A price sent by the
 *    client is a price chosen by the client.
 * 3. **The row is created `pending`.** It grants nothing. Only the Stripe
 *    webhook turns it `active` (story 2.4, architecture D5), and that is
 *    what makes this write safe: the worst a crafted request can produce is
 *    a registration that has paid nothing and can do nothing.
 */
export async function startRegistration(
  _previous: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const slug = String(formData.get("tier") ?? "");

  const acceptedTerms = formData.get("cgv") === "on";
  const acceptedTaxNotice = formData.get("fiscal") === "on";

  const errors: Record<string, string> = {};
  if (!acceptedTerms) {
    errors.cgv = "Vous devez accepter les conditions générales de vente.";
  }
  if (!acceptedTaxNotice) {
    errors.fiscal =
      "Vous devez reconnaître qu’il ne s’agit pas d’un don défiscalisable.";
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // The middleware normally prevents this. Checking again because a page
    // must never depend on middleware alone for its access control.
    redirect(`${ROUTES.signIn}?suite=${ROUTES.participate}/${slug}`);
  }

  const tier = await getTierBySlug(slug);

  if (!tier) {
    // Includes the case where the database could not be read. Refusing is
    // the only safe answer: the next step charges money.
    return {
      message:
        "Ce niveau d’inscription n’est pas disponible. Réessayez dans quelques instants.",
    };
  }

  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return {
      message:
        "L’édition n’est pas encore ouverte. Réessayez dans quelques instants.",
    };
  }

  const { data: existing } = await admin
    .from("registrations")
    .select("id, status")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  // Already paid: nothing to do here (AC 7). Sending them back to their
  // account rather than showing an error — they have done nothing wrong.
  if (existing?.status === "active") {
    redirect(ROUTES.account);
  }

  const acceptance = {
    tier_id: tier.id,
    terms_accepted_at: new Date().toISOString(),
    terms_version: TERMS_VERSION,
  };

  let registrationId = existing?.id ?? null;

  if (existing) {
    // An abandoned attempt is resumed rather than duplicated — the unique
    // constraint would refuse a second row anyway (story 2.1). The tier is
    // updated because they may have changed their mind.
    await admin.from("registrations").update(acceptance).eq("id", existing.id);
  } else {
    const { data, error } = await admin
      .from("registrations")
      .insert({
        profile_id: user.id,
        edition_id: edition.id,
        status: "pending",
        ...acceptance,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("[inscription] création impossible", { code: error?.code });
      return {
        message:
          "Votre inscription n’a pas pu être enregistrée. Réessayez dans un instant.",
      };
    }

    registrationId = data.id;
  }

  // The `pending` row exists before anyone is sent to Stripe, and that
  // ordering is the point: a payment that goes astray still has a thread to
  // pull on. Without it, someone who abandons halfway leaves no trace, and
  // there is nothing to answer with when they write "j'ai payé et je n'ai
  // rien reçu".
  redirect(
    await paymentHandoff({
      registrationId: registrationId as string,
      profileId: user.id,
      editionId: edition.id,
      tier,
      email: user.email,
    }),
  );
}

/**
 * Picks an abandoned payment back up.
 *
 * The tier comes from the **registration already recorded**, not from the
 * request. Someone who chose "Sportif légendaire", left, and comes back is
 * charged for what they chose — and a crafted request cannot swap it for the
 * cheapest one on the way back in.
 *
 * A fresh Stripe session is created rather than the old one reused. Sessions
 * expire, and one that has expired shows a dead end; creating another costs
 * nothing and always works. What is resumed is the registration, which is
 * where the acceptance and the choice live.
 */
export async function resumeCheckout(
  _previous: RegistrationFormState,
  _formData: FormData,
): Promise<RegistrationFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.signIn);

  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return {
      message: "L’édition n’est pas encore ouverte. Réessayez plus tard.",
    };
  }

  const { data: registration } = await admin
    .from("registrations")
    .select("id, status, tier_id")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  // Already paid (AC 8). Creating a second session would let someone pay
  // twice for one registration, and the only cure for that is a refund.
  if (registration?.status === "active") redirect(ROUTES.account);

  if (!registration) redirect(ROUTES.participate);

  const tier = await getTierById(registration.tier_id);

  if (!tier) {
    return {
      message:
        "Votre niveau d’inscription n’a pas pu être relu. Réessayez dans quelques instants.",
    };
  }

  redirect(
    await paymentHandoff({
      registrationId: registration.id,
      profileId: user.id,
      editionId: edition.id,
      tier,
      email: user.email,
    }),
  );
}
