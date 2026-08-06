import "server-only";

import {
  CARD_BUCKET,
  checkImage,
  imageObjectName,
  imageObjectNameFromUrl,
  imagePublicUrl,
} from "@/lib/cards/form";
import { createClient } from "@/lib/supabase/server";

/**
 * Putting a card's picture somewhere it can be served from.
 *
 * Through the administrator's own session, like every other back-office
 * write. Storage has its own row level security, and the bucket's policies
 * (migration `20260806150000`) are what actually decide — not this file
 * remembering to check.
 *
 * **The picture is uploaded before the card row is written, never after.**
 * The two orders fail differently, and only one of them fails acceptably:
 * upload-then-write leaves an unreferenced file in the bucket when the write
 * fails, which costs a few hundred kilobytes and nothing else, while
 * write-then-upload leaves a card saved without its visual and a volunteer
 * who believes the job is done.
 */

export type UploadResult =
  { ok: true; url: string } | { ok: false; message: string };

export async function uploadCardImage(file: File): Promise<UploadResult> {
  const checked = checkImage({ size: file.size, type: file.type });
  if (!checked.ok) return { ok: false, message: checked.message };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    console.error("[cartes] téléversement impossible : URL Supabase absente");
    return {
      ok: false,
      message:
        "Le stockage des visuels n’est pas configuré. Prévenez la personne qui gère l’hébergement.",
    };
  }

  const supabase = await createClient();
  const objectName = imageObjectName(crypto.randomUUID(), checked.extension);

  const { error } = await supabase.storage
    .from(CARD_BUCKET)
    .upload(objectName, file, {
      contentType: file.type,
      // Never overwrite: the name is random, so a collision would mean
      // something is wrong rather than something is being replaced.
      upsert: false,
      // A year. The name changes whenever the picture does, so a long cache
      // is free — and it is what makes the album open quickly on mobile data.
      cacheControl: "31536000",
    });

  if (error) {
    console.error("[cartes] visuel non téléversé", { message: error.message });

    return {
      ok: false,
      message:
        "Le visuel n’a pas pu être envoyé. Réessayez — le reste de votre saisie est toujours à l’écran.",
    };
  }

  return { ok: true, url: imagePublicUrl(url, objectName) };
}

/**
 * Sweeps the picture a card no longer uses.
 *
 * Best effort, and deliberately silent on failure. It runs after the card has
 * already been saved with its new visual: refusing the save because an old
 * file could not be removed would trade a real problem for an imaginary one.
 * What is left behind is an unreferenced object, which the storage bill will
 * never notice at fifty cards.
 */
export async function removeCardImage(url: string): Promise<void> {
  const objectName = imageObjectNameFromUrl(url);
  if (!objectName) return;

  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(CARD_BUCKET)
    .remove([objectName]);

  if (error) {
    console.error("[cartes] ancien visuel non supprimé", {
      message: error.message,
    });
  }
}
