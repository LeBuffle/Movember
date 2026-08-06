"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  GATE_COOKIE,
  GATE_MAX_AGE,
  gateCode,
  gateToken,
} from "@/lib/gate/access";

/**
 * Checking the entry code.
 *
 * The comparison happens here and only here — the cookie that follows carries
 * a keyed digest, never the code itself, because a cookie is readable by
 * anyone holding the device.
 */

export type AccessFormState = {
  message?: string;
};

/** Slows a patient guesser without annoying a person who mistypes once. */
const PAUSE_MS = 400;

export async function unlockAccess(
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const expected = gateCode();

  // Nothing to unlock: production, or an environment with no gate at all.
  if (!expected) redirect("/");

  const given = String(formData.get("code") ?? "").trim();

  if (given !== expected) {
    // A short, unconditional pause. Not a real rate limit — the environment
    // does not warrant one — but enough that a script cannot try a dictionary
    // in a minute.
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

    return { message: "Ce code n’est pas le bon." };
  }

  const raw = String(formData.get("suite") ?? "").trim();

  // Only a path within the site, never an absolute URL: a redirection whose
  // destination comes from the request is how an open redirect is built, and
  // this one is reachable by anybody.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const jar = await cookies();

  jar.set(GATE_COOKIE, await gateToken(expected), {
    httpOnly: true,
    secure: process.env.APP_ENVIRONMENT !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });

  redirect(next);
}
