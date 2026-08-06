import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { getParticipantAccess } from "@/lib/registration/access";

export const metadata = {
  title: "Le jeu — DEFI Movember",
  robots: { index: false, follow: false },
};

/** Evaluated per request: the check below has to run for each visitor. */
export const dynamic = "force-dynamic";

/**
 * The game shell — and the gate in front of it.
 *
 * **Nothing under `/jeu` opens before a registration is `active`** (FR12).
 * The check lives here rather than on each page so that a screen added by
 * epic 4, 5 or 7 is protected the moment its file exists — nobody has to
 * remember to add a guard, which is exactly the kind of thing one forgets in
 * October.
 *
 * A redirect rather than a 404, and the difference from the back-office
 * (story 1.10) is deliberate. There, hiding the existence of `/admin` from a
 * signed-in participant was worth something. Here it is worth nothing: the
 * whole site advertises the game, and someone who has paid and lands on a
 * "page introuvable" would reasonably conclude their payment vanished.
 * Sending them where the situation is explained is the kinder and the more
 * honest answer.
 */
export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getParticipantAccess();

  if (!access.signedIn) redirect(ROUTES.signIn);

  if (!access.isActive) {
    // `/participer` reads the registration and says where things stand —
    // choice not made, payment interrupted, or confirmation pending.
    redirect(ROUTES.participate);
  }

  // No header, no footer, no container: each screen wraps itself in
  // `ParticipantShell`, which carries the tinted band, the sunken page and
  // the tab bar. Putting the band here would mean one title for six screens.
  return children;
}
