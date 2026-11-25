import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The news feed.
 *
 * Read through the reader's own session, so row level security answers: a
 * participant sees what is published, an administrator sees the drafts too.
 * There is no second query and no filter in the application — which is what
 * makes "an unpublished message is invisible" a property of the database
 * rather than of this file remembering.
 */

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  imagePath: string;
  publishedAt: string | null;
  isPinned: boolean;
};

async function editionId(): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

function toPost(row: {
  id: string;
  title: string;
  body: string;
  image_path: string;
  published_at: string | null;
  is_pinned: boolean;
}): NewsPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imagePath: row.image_path,
    publishedAt: row.published_at,
    isPinned: row.is_pinned,
  };
}

/**
 * What a participant reads.
 *
 * Pinned first, then most recent. A pinned post outranks a fresher one on
 * purpose: the organisation pins the thing everybody needs — the rules of a
 * common challenge, a change of date — and it has to stay where people look.
 */
export async function publishedPosts(limit = 30): Promise<NewsPost[]> {
  const edition = await editionId();
  if (!edition) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("news_posts")
    .select("id, title, body, image_path, published_at, is_pinned")
    .eq("edition_id", edition)
    .not("published_at", "is", null)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[actualités] fil illisible", { code: error.code });
    return [];
  }

  return (data ?? []).map(toPost);
}

/** Everything, drafts included. Row level security grants this to admins. */
export async function allPosts(): Promise<NewsPost[]> {
  const edition = await editionId();
  if (!edition) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("news_posts")
    .select("id, title, body, image_path, published_at, is_pinned")
    .eq("edition_id", edition)
    // Drafts first: they are the ones waiting for something to be done.
    .order("published_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[actualités] liste illisible", { code: error.code });
    return [];
  }

  return (data ?? []).map(toPost);
}

export async function getPost(id: string): Promise<NewsPost | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("news_posts")
    .select("id, title, body, image_path, published_at, is_pinned")
    .eq("id", id)
    .maybeSingle();

  return data ? toPost(data) : null;
}
