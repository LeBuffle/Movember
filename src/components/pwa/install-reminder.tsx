"use client";

import Link from "next/link";

import { useDisplayMode } from "@/components/pwa/use-display-mode";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";

/**
 * The reminder for whoever skipped the installation step.
 *
 * **Skipping has to be allowed** (story 6.2 AC 4). Somebody registering on a
 * borrowed computer, or in a hurry, must not be blocked at a payment
 * confirmation by an instruction they cannot follow right now. So the step
 * lets them through — and this brings the question back, on the screen they
 * open every morning.
 *
 * Renders nothing at all once the app is installed, and nothing during
 * detection: a banner that appears for one frame and vanishes is worse than
 * no banner.
 */
export function InstallReminder() {
  const mode = useDisplayMode();

  if (mode !== "browser") return null;

  return (
    <Alert tone="info" title="Installez l’application pour être prévenu">
      <p>
        Sur iPhone, les notifications ne fonctionnent qu’une fois l’application
        ajoutée à l’écran d’accueil. Deux minutes, une fois pour toutes.
      </p>
      <p className="mt-3">
        <Link
          href="/installer"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Voir comment faire
        </Link>
      </p>
    </Alert>
  );
}
