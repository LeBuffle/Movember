"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { uploadImage } from "@/lib/cards/storage";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Publishing to the feed, from a phone.
 *
 * **Publishing does not send a notification** (story 7.8 AC 7). The feed is
 * the calm channel and the notification is the one that interrupts; linking
 * them would turn every small announcement into an interruption, and that is
 * how people end up switching notifications off. When a message deserves to
 * interrupt, the back-office has a screen for exactly that (story 6.8).
 *
 * The image goes through the same storage as the card visuals (story 5.6):
 * one bucket, one set of rules, one place where the size limit lives.
 */

export type NewsFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  saved?: boolean;
};

const REFUSED: NewsFormState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function savePost(
  _previous: NewsFormState,
  formData: FormData,
): Promise<NewsFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isPinned = formData.get("isPinned") === "on";

  const fieldErrors: Record<string, string> = {};

  if (title.length < 2 || title.length > 120) {
    fieldErrors.title = "Le titre doit faire entre 2 et 120 caractères.";
  }
  if (body.length > 4000) {
    fieldErrors.body = "Le message ne peut pas dépasser 4000 caractères.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // The picture first, and nothing is written if it fails — same order and
  // same reason as the card catalogue: the other way round saves a post the
  // author believes has its image.
  const file = formData.get("image");
  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadImage(file);
    if (!uploaded.ok) return { fieldErrors: { image: uploaded.message } };
    imageUrl = uploaded.url;
  }

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return { message: "L’édition n’a pas été trouvée." };
  }

  const row = {
    edition_id: edition.id,
    title,
    body,
    is_pinned: isPinned,
    ...(imageUrl ? { image_path: imageUrl } : {}),
  };

  const saved = id
    ? await supabase
        .from("news_posts")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("news_posts")
        .insert({ ...row, author_id: admin.id })
        .select("id")
        .maybeSingle();

  if (saved.error || !saved.data) {
    console.error("[actualités] enregistrement impossible", {
      code: saved.error?.code,
    });

    return {
      message:
        "Le message n’a pas pu être enregistré. Réessayez — votre saisie est toujours à l’écran.",
    };
  }

  await logAdminAction({
    action: id ? "news.updated" : "news.created",
    targetTable: "news_posts",
    targetId: saved.data.id,
    payload: { title, pinned: isPinned },
  });

  revalidatePath("/admin/actualites");
  revalidatePath("/jeu/actualites");
  redirect(`/admin/actualites?enregistre=${saved.data.id}`);
}

/**
 * Publishing, or taking a message back off the feed.
 *
 * Unpublishing rather than deleting: a message that was up for two days and
 * then withdrawn is a fact, and "why did this disappear" is a question that
 * gets asked. The row stays, invisible to participants.
 */
export async function setPostPublished(
  _previous: NewsFormState,
  formData: FormData,
): Promise<NewsFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  const publish = formData.get("published") === "true";

  if (!id) return { message: "Message introuvable." };

  const supabase = await createClient();

  const update = supabase
    .from("news_posts")
    .update({
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // The guard carried by the write: two volunteers on two phones must not
  // both believe they published it, and a publication date must not be
  // quietly pushed forward by a second press.
  const guarded = publish
    ? update.is("published_at", null)
    : update.not("published_at", "is", null);

  const { data, error } = await guarded.select("id, title");

  if (error) {
    console.error("[actualités] publication impossible", { code: error.code });
    return { message: "L’état du message n’a pas pu être changé." };
  }

  if ((data ?? []).length === 0) {
    return {
      message: publish
        ? "Ce message était déjà publié."
        : "Ce message n’est plus publié.",
    };
  }

  await logAdminAction({
    action: publish ? "news.published" : "news.unpublished",
    targetTable: "news_posts",
    targetId: id,
    payload: { title: data![0]!.title },
  });

  revalidatePath("/admin/actualites");
  revalidatePath("/jeu/actualites");
  return { saved: true };
}
