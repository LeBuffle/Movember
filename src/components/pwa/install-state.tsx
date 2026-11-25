"use client";

import { useDisplayMode } from "@/components/pwa/use-display-mode";
import { Badge } from "@/components/ui/badge";

/**
 * Says out loud whether the app is running from the home screen.
 *
 * Its purpose is verification, not decoration. Story 1.8 has to be checked
 * on a real iPhone and a real Android — an emulator does not install to a
 * home screen — and "is it really installed?" is otherwise a matter of
 * squinting at whether an address bar is present. This makes the answer
 * unambiguous on the device itself.
 *
 * Epic 6 reuses `useDisplayMode` for the decision that matters: whether to
 * offer notifications or to explain how to install first.
 */
export function InstallState() {
  const mode = useDisplayMode();

  if (mode === null) {
    return <Badge tone="neutral">Détection en cours…</Badge>;
  }

  return mode === "installed" ? (
    <Badge tone="success">Application installée</Badge>
  ) : (
    <Badge tone="neutral">Ouverte dans un navigateur</Badge>
  );
}
