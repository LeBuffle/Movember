import "server-only";

import {
  LOGO_BUCKET,
  checkLogo,
  logoObjectName,
  logoObjectNameFromUrl,
  logoPublicUrl,
} from "@/lib/super-teams/logo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Putting a logo somewhere it can be served from.
 *
 * **Through the service key, and this is the one place in the epic that
 * deserves the explanation the admin client asks for.** Card visuals go up
 * through the administrator's own session, because storage policies can check
 * `is_admin()` and that is a fact about the caller. Captaincy is not: the
 * picture is uploaded before anything links it to a team, so at the moment a
 * policy would run there is nothing to check it against. The only policy that
 * would work is "any authenticated participant may write to `logos`", which
 * is a bucket anybody can fill with anything.
 *
 * So the captaincy is established from the session by the action that calls
 * in, and the bucket keeps enforcing what it can enforce for every key
 * including this one: format and weight.
 *
 * **The picture is uploaded before the row is written, never after.** The two
 * orders fail differently and only one fails acceptably: upload-then-write
 * leaves an unreferenced file in the bucket, which costs a few hundred
 * kilobytes; write-then-upload leaves a team saved without its logo and a
 * captain who believes the job is done.
 */

export type LogoUpload =
  { ok: true; url: string } | { ok: false; message: string };

export async function uploadLogo(file: File): Promise<LogoUpload> {
  const checked = checkLogo({ size: file.size, type: file.type });
  if (!checked.ok) return { ok: false, message: checked.message };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    console.error("[logos] téléversement impossible : URL Supabase absente");

    return {
      ok: false,
      message:
        "Le stockage des logos n’est pas configuré. Prévenez la personne qui gère l’hébergement.",
    };
  }

  const admin = createAdminClient();
  const objectName = logoObjectName(crypto.randomUUID(), checked.extension);

  const { error } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(objectName, file, {
      contentType: file.type,
      // Never overwrite: the name is random, so a collision would mean
      // something is wrong rather than something is being replaced.
      upsert: false,
      // A year. The name changes whenever the picture does, so a long cache
      // is free — and it is what keeps a ranking page of forty badges quick.
      cacheControl: "31536000",
    });

  if (error) {
    console.error("[logos] logo non téléversé", { message: error.message });

    return {
      ok: false,
      message:
        "Le logo n’a pas pu être envoyé. Réessayez — rien d’autre n’a changé.",
    };
  }

  return { ok: true, url: logoPublicUrl(url, objectName) };
}

/**
 * Sweeps a logo that is no longer used.
 *
 * Best effort, and deliberately silent on failure. It runs after the row has
 * already been saved without it: refusing the change because an old file
 * could not be removed would trade a real problem for an imaginary one.
 */
export async function removeLogoObject(url: string): Promise<void> {
  const objectName = logoObjectNameFromUrl(url);
  if (!objectName) return;

  const admin = createAdminClient();

  const { error } = await admin.storage.from(LOGO_BUCKET).remove([objectName]);

  if (error) {
    console.error("[logos] ancien logo non supprimé", {
      message: error.message,
    });
  }
}
