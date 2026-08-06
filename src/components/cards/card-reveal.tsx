"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The wrapper that plays the reveal, and lets it be cut short.
 *
 * **Everything it wraps is rendered by the server, already revealed.** This
 * component adds an animation over finished HTML; it never decides what is
 * shown. Without JavaScript the card is on the page all the same, the CSS
 * animation plays on its own, and its last keyframe is the resting state
 * (story 5.5 AC 6).
 *
 * Skipping is a first tap or a first key press anywhere on the page, not a
 * button. On a phone, the instinct when something is playing is to touch the
 * screen — a "passer" button placed somewhere would be found on the fourth
 * card, not the first. The listeners are removed as soon as the animation
 * is over, so nothing lingers to swallow a later tap.
 */
export function CardReveal({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (seen) return;

    const skip = () => setSeen(true);

    // `once` on each, so a scroll or a second tap costs nothing.
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    // Past the animation's own length there is nothing left to skip.
    const timer = window.setTimeout(skip, 800);

    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.clearTimeout(timer);
    };
  }, [seen]);

  return (
    <div className="carte-revelation" data-vue={seen ? "oui" : "non"}>
      {children}
    </div>
  );
}
