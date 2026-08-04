"use client";

import { useEffect, useState } from "react";

import { getDisplayMode, type DisplayMode } from "@/lib/pwa/display-mode";

/**
 * React binding for `getDisplayMode`.
 *
 * Returns `null` until the browser has been asked. That third value is not
 * over-engineering: the server cannot know how the page was opened, so
 * returning "browser" on the first render would make the markup disagree
 * with the client and React would warn. It also lets a caller say nothing at
 * all rather than flash the wrong message for one frame — which matters in
 * epic 6, where the wrong message is "installez l'application" shown to
 * someone who already did.
 *
 * The media query is subscribed to, not merely read: on Android a user can
 * install the app while it is open, and the answer changes underneath us.
 */
export function useDisplayMode(): DisplayMode | null {
  const [mode, setMode] = useState<DisplayMode | null>(null);

  useEffect(() => {
    const read = () =>
      setMode(
        getDisplayMode({
          matchMedia: (query) => window.matchMedia(query),
          /* `standalone` is Apple's, not the standard's, so it is absent
             from the DOM typings. The cast is confined to this one line. */
          navigator: {
            standalone: (navigator as { standalone?: boolean }).standalone,
          },
          document: { referrer: document.referrer },
        }),
      );

    read();

    const query = window.matchMedia("(display-mode: standalone)");
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  return mode;
}
