"use server";

import { revalidatePath } from "next/cache";

import type { NotificationCategory } from "@/lib/notifications/payload";
import { savePreferences } from "@/lib/notifications/preferences";

/**
 * Saving what somebody wants to hear about.
 *
 * The form posts one checkbox per category and per channel. An unchecked box
 * sends nothing at all, which is why every key is read explicitly rather than
 * iterated over what arrived: an absent key would otherwise be
 * indistinguishable from a category that was never on the form, and a future
 * category added to the screen but forgotten here would silently reset.
 */

export type PreferencesState = {
  saved?: boolean;
  message?: string;
};

const CATEGORIES: NotificationCategory[] = [
  "defi_du_jour",
  "resultat",
  "carte",
  "annonce",
  "relance",
];

export async function saveNotificationPreferences(
  _previous: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const checked = (name: string) => formData.get(name) === "on";

  const saved = await savePreferences({
    channelPush: checked("channel_push"),
    channelEmail: checked("channel_email"),
    categories: Object.fromEntries(
      CATEGORIES.map((category) => [category, checked(category)]),
    ) as Record<NotificationCategory, boolean>,
  });

  if (!saved) {
    return {
      message:
        "Vos préférences n’ont pas pu être enregistrées. Réessayez dans un instant.",
    };
  }

  revalidatePath("/mon-compte/notifications");
  return { saved: true };
}
