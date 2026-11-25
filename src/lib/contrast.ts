/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Used by `tests/unit/contrast.test.ts` to keep the palette accessible: the
 * blue/orange pairing is easy to get wrong, and a colour tweak that quietly
 * drops a ratio below AA would make challenge states unreadable for part of
 * the participants.
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHexColor(hex: string): Rgb {
  const normalised = hex.trim().replace(/^#/, "");

  const expanded =
    normalised.length === 3
      ? normalised
          .split("")
          .map((char) => char + char)
          .join("")
      : normalised;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** Contrast ratio between two hex colours, from 1 (identical) to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(parseHexColor(foreground));
  const l2 = relativeLuminance(parseHexColor(background));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 AA thresholds. */
export const AA_BODY_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;
