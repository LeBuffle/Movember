import "server-only";

import type { NotificationCategory } from "@/lib/notifications/payload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * What each participant agreed to be told about.
 *
 * **The absence of a row means everything is on.** Silence is not a refusal:
 * the opposite default would leave participants silently deprived of their
 * daily challenge, with nothing on any screen showing why — the kind of
 * defect nobody reports because nobody notices it.
 *
 * The reading is done with the service key, and that is not laziness. A send
 * runs from a scheduled task with no session at all, and it needs the
 * preferences of eight hundred people it is not. Row level security still
 * governs the screen where a participant edits their own row.
 */

export type Preferences = {
  channelPush: boolean;
  channelEmail: boolean;
  categories: Record<NotificationCategory, boolean>;
};

export const ALL_ON: Preferences = {
  channelPush: true,
  channelEmail: true,
  categories: {
    defi_du_jour: true,
    resultat: true,
    carte: true,
    annonce: true,
    relance: true,
    defi_joueur: true,
  },
};

/**
 * Column per category, spelled out rather than derived.
 *
 * Both here and in the select below, on purpose. A list built at runtime is a
 * list the compiler cannot check against the table's types, and this is
 * exactly where a silent mismatch would read as "not interested".
 */
const COLUMNS = {
  defi_du_jour: "cat_defi_du_jour",
  resultat: "cat_resultat",
  carte: "cat_carte",
  annonce: "cat_annonce",
  relance: "cat_relance",
  defi_joueur: "cat_defi_joueur",
} as const satisfies Record<NotificationCategory, string>;

const SELECTION =
  "profile_id, channel_push, channel_email, cat_defi_du_jour, cat_resultat, cat_carte, cat_annonce, cat_relance, cat_defi_joueur";

type Row = {
  profile_id: string;
  channel_push: boolean;
  channel_email: boolean;
  cat_defi_du_jour: boolean;
  cat_resultat: boolean;
  cat_carte: boolean;
  cat_annonce: boolean;
  cat_relance: boolean;
  cat_defi_joueur: boolean;
};

function toPreferences(row: Row | null | undefined): Preferences {
  if (!row) return ALL_ON;

  // `!== false` rather than a plain read: a column added later and not yet
  // backfilled arrives as null, and null must mean "on" like a missing row
  // does — never "not interested".
  return {
    channelPush: row.channel_push !== false,
    channelEmail: row.channel_email !== false,
    categories: {
      defi_du_jour: row.cat_defi_du_jour !== false,
      resultat: row.cat_resultat !== false,
      carte: row.cat_carte !== false,
      annonce: row.cat_annonce !== false,
      relance: row.cat_relance !== false,
      defi_joueur: row.cat_defi_joueur !== false,
    },
  };
}

/** The signed-in participant's own preferences, for their screen. */
export async function ownPreferences(): Promise<Preferences> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return ALL_ON;

  const { data } = await supabase
    .from("notification_preferences")
    .select(SELECTION)
    .eq("profile_id", user.id)
    .maybeSingle();

  return toPreferences(data as Row | null);
}

/**
 * The preferences of a whole send, in one query.
 *
 * Returns a map covering **every** identifier asked for, filled in with the
 * defaults for whoever has no row. A caller that had to remember the missing
 * ones would eventually forget, and forgetting means not sending.
 */
export async function preferencesFor(
  profileIds: string[],
): Promise<Map<string, Preferences>> {
  const map = new Map<string, Preferences>(
    profileIds.map((id) => [id, ALL_ON]),
  );

  if (profileIds.length === 0) return map;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notification_preferences")
    .select(SELECTION)
    .in("profile_id", profileIds);

  if (error) {
    console.error("[notifications] préférences illisibles", {
      code: error.code,
    });
    // Everything on rather than nothing sent. The failure that matters here
    // is a participant who stops hearing about the game; being notified once
    // against a preference is a far smaller wrong than going silent on
    // everybody because one query failed.
    return map;
  }

  for (const row of (data ?? []) as unknown as Row[]) {
    map.set(row.profile_id, toPreferences(row));
  }

  return map;
}

export type Channel = "push" | "email" | "none";

/**
 * Which way this category should reach this participant.
 *
 * **The single place the preferences are applied.** Every send goes through
 * `dispatch.ts`, which goes through here — a preference bypassed by one route
 * would ruin the guarantee, and the route that bypasses it is always the one
 * added in a hurry.
 *
 * `hasDevice` and `essential` come from the caller because they are facts
 * about the send, not about the participant.
 */
export function channelFor(
  preferences: Preferences,
  category: NotificationCategory,
  options: { hasDevice: boolean; essential: boolean },
): Channel {
  if (!preferences.categories[category]) return "none";

  if (options.hasDevice && preferences.channelPush) return "push";

  // The e-mail fallback covers only the essential categories (architecture
  // D6). One e-mail per event would be up to 70 000 over the month, far past
  // the free quota — and a validated challenge is worth nothing an hour
  // later, which is exactly what an e-mail would be.
  if (options.essential && preferences.channelEmail) return "email";

  return "none";
}

export type PreferenceUpdate = Partial<{
  channelPush: boolean;
  channelEmail: boolean;
  categories: Partial<Record<NotificationCategory, boolean>>;
}>;

/**
 * Writes a participant's preferences.
 *
 * Through their own session, so row level security decides — this is the one
 * table in the notification set a participant is allowed to write, because
 * every column in it belongs to them and means only what they want.
 */
export async function savePreferences(
  update: PreferenceUpdate,
): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Spread rather than assigned key by key, so the compiler checks each name
  // against the table. Only what the caller actually supplied is written: a
  // screen that shows three of the five categories must not silently reset
  // the other two.
  const categories = update.categories ?? {};

  const row = {
    profile_id: user.id,
    updated_at: new Date().toISOString(),
    ...(update.channelPush !== undefined && {
      channel_push: update.channelPush,
    }),
    ...(update.channelEmail !== undefined && {
      channel_email: update.channelEmail,
    }),
    ...(categories.defi_du_jour !== undefined && {
      [COLUMNS.defi_du_jour]: categories.defi_du_jour,
    }),
    ...(categories.resultat !== undefined && {
      [COLUMNS.resultat]: categories.resultat,
    }),
    ...(categories.carte !== undefined && {
      [COLUMNS.carte]: categories.carte,
    }),
    ...(categories.annonce !== undefined && {
      [COLUMNS.annonce]: categories.annonce,
    }),
    ...(categories.relance !== undefined && {
      [COLUMNS.relance]: categories.relance,
    }),
  };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(row, { onConflict: "profile_id" });

  if (error) {
    console.error("[notifications] préférences non enregistrées", {
      code: error.code,
    });
    return false;
  }

  return true;
}
