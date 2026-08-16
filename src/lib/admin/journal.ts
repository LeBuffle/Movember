import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reading the administrative journal (story 8.8).
 *
 * **The table has existed since story 1.10 and nothing could read it.** Every
 * sensitive gesture writes a line to it — arbitration, refund, publication,
 * notification, team management, suspension — and until now seeing one meant
 * opening Supabase's SQL editor. A journal nobody can read protects nobody.
 *
 * Read through the administrator's own session rather than the service key.
 * The policy on the table already says "admins read the audit log", so the
 * session is the check; using the service key here would mean the screen
 * decides who may look, which is the arrangement that eventually goes wrong.
 *
 * Strictly read-only, and there is nothing to enforce: the table carries no
 * update policy and no delete policy at all. A journal that can be edited is
 * not a journal.
 */

export type JournalEntry = {
  id: string;
  action: string;
  /** Pseudonym of the administrator. Never their e-mail. */
  author: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type JournalPage = {
  entries: JournalEntry[];
  /** Distinct actions present, for the filter. Sorted, so the list is stable. */
  actions: string[];
  /** How many entries in total, filter applied. */
  total: number;
  page: number;
  pageCount: number;
};

const PAGE_SIZE = 25;

const EMPTY: JournalPage = {
  entries: [],
  actions: [],
  total: 0,
  page: 1,
  pageCount: 1,
};

type Row = {
  id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  admin_id: string;
};

/**
 * One page of the journal, newest first.
 *
 * @param action Restrict to a single verb. An unknown verb yields an empty
 *   page rather than the whole journal — a filter that silently stops
 *   filtering is worse than one that finds nothing.
 */
export async function getJournal(
  page = 1,
  action?: string,
): Promise<JournalPage> {
  const supabase = await createClient();

  const from = (Math.max(1, page) - 1) * PAGE_SIZE;

  let query = supabase
    .from("admin_audit_log")
    .select(
      "id, action, target_table, target_id, payload, created_at, admin_id",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;

  if (error) {
    console.error("[journal] lecture impossible", { code: error.code });
    return EMPTY;
  }

  const rows = (data ?? []) as unknown as Row[];

  // Pseudonyms in one query, from the public view. Reading `profiles` for a
  // name would hand over the e-mail addresses in the same request — the same
  // rule as every other screen that names somebody.
  const names = await authorNames(rows.map((row) => row.admin_id));

  const total = count ?? 0;

  return {
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      author: names.get(row.admin_id) ?? "Organisation",
      targetTable: row.target_table,
      targetId: row.target_id,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    })),
    actions: await distinctActions(),
    total,
    page: Math.max(1, page),
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function authorNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

/**
 * The verbs actually present, for the filter.
 *
 * Read from the journal rather than from a hard-coded list, because every
 * epic adds its own verbs — a list written here would be out of date by the
 * next story, and a filter offering an action that never happened is a filter
 * that makes people doubt the journal.
 *
 * Capped: it reads the recent entries rather than the whole table. In a month
 * of animation every verb in use will appear in the last five hundred lines.
 */
async function distinctActions(): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("admin_audit_log")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(500);

  return [...new Set((data ?? []).map((row) => row.action))].sort();
}
