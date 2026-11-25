import "server-only";

import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The shared moments of the month.
 *
 * A common challenge on 11 November, a collective goal on the last weekend —
 * this is what makes them possible (architecture D13). Read through the
 * administrator's own session, so row level security answers; participants
 * have no read policy on this table at all, because a shared surprise
 * announced a week ahead is not one.
 */

export type ScheduledCommon = {
  id: string;
  scheduledFor: string;
  mode: "replace" | "additional";
  challengeTitle: string;
  cancelled: boolean;
  /** Whether it can still be called off. */
  cancellable: boolean;
};

export async function listCommonChallenges(): Promise<ScheduledCommon[]> {
  const supabase = await createClient();
  const today = todayInParis();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await supabase
    .from("common_challenges")
    .select("id, scheduled_for, mode, cancelled_at, challenges (title)")
    .eq("edition_id", edition.id)
    .order("scheduled_for", { ascending: true });

  if (error) {
    console.error("[défi commun] lecture impossible", { code: error.code });
    return [];
  }

  type Row = {
    id: string;
    scheduled_for: string;
    mode: "replace" | "additional";
    cancelled_at: string | null;
    challenges: { title: string } | null;
  };

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    scheduledFor: row.scheduled_for,
    mode: row.mode,
    challengeTitle: row.challenges?.title ?? "défi supprimé",
    cancelled: row.cancelled_at !== null,
    // A day that has arrived has already had its assignments handed out.
    // Cancelling then would take a challenge away from people who can see it.
    cancellable: row.cancelled_at === null && row.scheduled_for > today,
  }));
}

/** The active challenges, to choose one from. */
export async function listChallengeOptions(): Promise<
  Array<{ value: string; label: string }>
> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data } = await supabase
    .from("challenges")
    .select("id, title")
    .eq("edition_id", edition.id)
    .eq("is_active", true)
    .order("title", { ascending: true })
    .limit(200);

  return (data ?? []).map((challenge) => ({
    value: challenge.id,
    label: challenge.title,
  }));
}
