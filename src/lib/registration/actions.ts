"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { TERMS_VERSION } from "@/lib/legal/notices";
import { getTierBySlug } from "@/lib/registration/tiers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RegistrationFormState = {
  errors?: Record<string, string>;
  message?: string;
};

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

  if (existing) {
    // An abandoned attempt is resumed rather than duplicated — the unique
    // constraint would refuse a second row anyway (story 2.1). The tier is
    // updated because they may have changed their mind.
    await admin.from("registrations").update(acceptance).eq("id", existing.id);
  } else {
    const { error } = await admin.from("registrations").insert({
      profile_id: user.id,
      edition_id: edition.id,
      status: "pending",
      ...acceptance,
    });

    if (error) {
      console.error("[inscription] création impossible", { code: error.code });
      return {
        message:
          "Votre inscription n’a pas pu être enregistrée. Réessayez dans un instant.",
      };
    }
  }

  // Story 2.3 replaces this with the Stripe Checkout session. Until then the
  // participant lands on a page that says plainly where things stand —
  // rather than on a payment form that does not exist yet.
  redirect(`${ROUTES.participate}/${slug}/paiement`);
}
