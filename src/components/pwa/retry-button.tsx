"use client";

import { Button } from "@/components/ui/button";

/**
 * Reloads the current page.
 *
 * A link back to the home page would not do: offline, that navigation is
 * answered by the service worker with this very page, and the participant
 * appears to be stuck. Reloading actually retries the network.
 */
export function RetryButton() {
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      Réessayer
    </Button>
  );
}
