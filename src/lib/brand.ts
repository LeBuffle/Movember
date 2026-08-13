/**
 * Brand values that have to exist outside CSS.
 *
 * The palette lives in `src/app/globals.css` and that file stays the single
 * source of truth. But a few places cannot read a stylesheet — the web app
 * manifest, the `theme-color` meta tag, the icon generator — and need the
 * raw value.
 *
 * Rather than let the two drift, `tests/unit/pwa.test.ts` reads
 * `globals.css` and fails if the constants below no longer match it. Same
 * arrangement as the contrast test: duplicated on purpose, checked by a
 * test rather than by memory.
 */

/** `--color-brand-blue`. Tints the browser and system chrome. */
export const THEME_COLOR = "#01294d";

/** `--color-surface`. Behind the splash screen while the app boots. */
export const BACKGROUND_COLOR = "#ffffff";
