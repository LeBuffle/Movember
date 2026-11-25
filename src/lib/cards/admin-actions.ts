"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  CARD_DETAIL_LABELS,
  cardDetailsSchema,
  parseRarityWeights,
} from "@/lib/cards/form";
import { removeImage, uploadImage } from "@/lib/cards/storage";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Writing the card catalogue, from the back-office.
 *
 * **This is what makes epic 5 survive the visuals arriving late.** A card is
 * published the day its picture exists, not the day the code ships
 * (architecture D2) — so nothing here may need a deployment, and nothing here
 * may need a developer.
 *
 * Through the administrator's own session, not the service key, like the
 * challenge catalogue. Row level security decides, on the server, from the
 * role held in the database.
 *
 * Every action is journalised. A catalogue three people edit in November,
 * from three phones, has to be able to answer "who published this card, and
 * when" — and answer it in December.
 */

export type CardFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
};

export type WeightsFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  saved?: boolean;
};

const REFUSED: CardFormState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function saveCard(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim() || null;

  const details = cardDetailsSchema.safeParse({
    title: formData.get("title") ?? "",
    description: String(formData.get("description") ?? ""),
    rarity: String(formData.get("rarity") ?? ""),
  });

  if (!details.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of details.error.issues) {
      const key = String(issue.path[0] ?? "");
      const label = CARD_DETAIL_LABELS[key] ?? key;

      fieldErrors[key] ??=
        issue.code === "invalid_value" || issue.code === "invalid_type"
          ? `${label} : choisissez une valeur.`
          : issue.message;
    }

    return { fieldErrors };
  }

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return {
      message:
        "L’édition n’a pas été trouvée. Prévenez la personne qui gère la base.",
    };
  }

  // The picture goes up first, and nothing is written if it fails. The other
  // order would save a card the volunteer believes has its visual.
  const file = formData.get("image");
  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadImage(file);
    if (!uploaded.ok) return { fieldErrors: { image: uploaded.message } };
    imageUrl = uploaded.url;
  }

  const row = {
    edition_id: edition.id,
    title: details.data.title,
    description: details.data.description,
    rarity: details.data.rarity,
    ...(imageUrl ? { image_path: imageUrl } : {}),
  };

  // Kept for the sweep below: replacing a picture leaves the previous object
  // behind, and fifty forgotten files is fifty files nobody ever removes.
  const previousImage = id ? await currentImage(supabase, id) : null;

  const saved = id
    ? await supabase
        .from("cards")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("cards")
        .insert({ ...row, created_by: admin.id })
        .select("id")
        .maybeSingle();

  if (saved.error || !saved.data) {
    console.error("[cartes] enregistrement impossible", {
      code: saved.error?.code,
      message: saved.error?.message,
    });

    return {
      message:
        "La carte n’a pas pu être enregistrée. Réessayez dans un instant — rien n’a été perdu, votre saisie est toujours à l’écran.",
    };
  }

  if (imageUrl && previousImage && previousImage !== imageUrl) {
    await removeImage(previousImage);
  }

  await logAdminAction({
    action: id ? "card.updated" : "card.created",
    targetTable: "cards",
    targetId: saved.data.id,
    payload: {
      title: row.title,
      rarity: row.rarity,
      image_replaced: Boolean(imageUrl),
    },
  });

  revalidatePath("/admin/cartes");
  redirect(`/admin/cartes?enregistre=${saved.data.id}`);
}

async function currentImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("cards")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  return data?.image_path || null;
}

/**
 * Publishing a card, or taking it back off the board (AC 1, 3, 7).
 *
 * Publication is what makes a card drawable — the draw reads the catalogue on
 * every completed challenge and keeps only what carries a `published_at`, so
 * a card published at nine in the morning can come out at nine oh one,
 * without a deployment and without a restart.
 *
 * Unpublishing is allowed and does **not** take anything back: cards already
 * handed out stay in their albums. It removes a card from future draws, which
 * is what somebody who spots a typo in November actually needs.
 */
export async function setCardPublished(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  const publish = formData.get("published") === "true";

  if (!id) return { message: "Carte introuvable." };

  const supabase = await createClient();

  const update = supabase
    .from("cards")
    .update({
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // The guard is carried by the write, not by a read made a moment before:
  // two volunteers on two phones must not both believe they published it,
  // and a publication date must not be quietly pushed forward by a second
  // press.
  const guarded = publish
    ? update.is("published_at", null)
    : update.not("published_at", "is", null);

  const { data, error } = await guarded.select("id, title, rarity");

  if (error) {
    console.error("[cartes] publication impossible", { code: error.code });
    return { message: "L’état de publication n’a pas pu être changé." };
  }

  if ((data ?? []).length === 0) {
    return {
      message: publish
        ? "Cette carte était déjà publiée."
        : "Cette carte n’est plus publiée.",
    };
  }

  await logAdminAction({
    action: publish ? "card.published" : "card.unpublished",
    targetTable: "cards",
    targetId: id,
    payload: { title: data![0]!.title, rarity: data![0]!.rarity },
  });

  revalidatePath("/admin/cartes");
  revalidatePath("/jeu/collection");
  return {};
}

/**
 * Removing a card that was never published (AC 4).
 *
 * A published card is never deleted, and that is enforced three times over:
 * this screen never offers the button, the write carries `is("published_at",
 * null)`, and the database refuses with a trigger. Three layers because the
 * consequence is somebody's completed challenge vanishing from their history
 * — and the first two are code, which is exactly what gets edited in a hurry
 * in November.
 */
export async function deleteCard(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: "Carte introuvable." };

  const supabase = await createClient();

  const { data: card } = await supabase
    .from("cards")
    .select("title, rarity, image_path, published_at")
    .eq("id", id)
    .maybeSingle();

  if (!card) return { message: "Carte introuvable." };

  if (card.published_at) {
    return {
      message:
        "Cette carte est publiée : elle ne peut plus être supprimée. Dépubliez-la pour qu’elle ne soit plus tirée — les collections déjà constituées restent intactes.",
    };
  }

  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id)
    .is("published_at", null)
    .select("id");

  if (error) {
    console.error("[cartes] suppression impossible", { code: error.code });

    return {
      message:
        "Cette carte n’a pas pu être supprimée. Si elle a déjà été attribuée à quelqu’un, la base la conserve volontairement.",
    };
  }

  if ((data ?? []).length === 0) {
    return { message: "Cette carte a été publiée entre-temps." };
  }

  if (card.image_path) await removeImage(card.image_path);

  await logAdminAction({
    action: "card.deleted",
    targetTable: "cards",
    targetId: id,
    payload: { title: card.title, rarity: card.rarity },
  });

  revalidatePath("/admin/cartes");
  redirect("/admin/cartes?supprime=1");
}

/**
 * Adjusting the draw odds (AC 5).
 *
 * The reason `card_rarities` is a table rather than an enum. A legendary too
 * rare demoralises, one too common is worth nothing, and nobody will know
 * which until November is under way — so the adjustment has to be a form, not
 * a deployment.
 *
 * Journalised with the previous values as well as the new ones. "The odds
 * changed on the 12th" is a question that gets asked afterwards, by somebody
 * comparing their luck to a friend's.
 */
export async function saveRarityWeights(
  _previous: WeightsFormState,
  formData: FormData,
): Promise<WeightsFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: REFUSED.message };

  const checked = parseRarityWeights({
    commune: String(formData.get("commune") ?? ""),
    rare: String(formData.get("rare") ?? ""),
    epique: String(formData.get("epique") ?? ""),
    legendaire: String(formData.get("legendaire") ?? ""),
  });

  if (!checked.ok) return { fieldErrors: checked.errors };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("card_rarities")
    .select("slug, weight");

  for (const entry of checked.weights) {
    const { error } = await supabase
      .from("card_rarities")
      .update({ weight: entry.weight })
      .eq("slug", entry.slug);

    if (error) {
      console.error("[cartes] poids non enregistré", {
        slug: entry.slug,
        code: error.code,
      });

      return {
        message:
          "Les probabilités n’ont pas toutes pu être enregistrées. Rechargez la page pour voir ce qui a été pris en compte.",
      };
    }
  }

  await logAdminAction({
    action: "card_rarities.reweighted",
    targetTable: "card_rarities",
    payload: {
      before: Object.fromEntries(
        (before ?? []).map((row) => [row.slug, row.weight]),
      ),
      after: Object.fromEntries(
        checked.weights.map((entry) => [entry.slug, entry.weight]),
      ),
    },
  });

  revalidatePath("/admin/cartes/raretes");
  return { saved: true };
}
