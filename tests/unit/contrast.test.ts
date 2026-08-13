import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHALLENGE_STATUS_LABELS } from "@/lib/challenges/status";
import {
  AA_BODY_TEXT,
  AA_LARGE_TEXT,
  AA_NON_TEXT,
  contrastRatio,
} from "@/lib/contrast";

/**
 * Reads the real stylesheet rather than a duplicated copy of the palette, so
 * the two can never drift apart: changing a colour in globals.css is what
 * this test checks.
 */
function readThemeColors(): Record<string, string> {
  const css = readFileSync(
    path.join(import.meta.dirname, "../../src/app/globals.css"),
    "utf8",
  );

  const colors: Record<string, string> = {};
  const declaration = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g;

  for (const match of css.matchAll(declaration)) {
    colors[match[1]] = match[2];
  }

  return colors;
}

const colors = readThemeColors();
const WHITE = "#ffffff";

describe("design tokens", () => {
  it("declares every brand and semantic colour", () => {
    expect(Object.keys(colors)).toEqual(
      expect.arrayContaining([
        "brand-blue",
        "brand-blue-dark",
        "brand-orange",
        "brand-orange-ink",
        "brand-orange-on-blue",
        "ink",
        "ink-muted",
        "success",
        "danger",
      ]),
    );
  });
});

describe("colours that carry text meet WCAG AA (4.5:1)", () => {
  const textColors = [
    "brand-blue",
    "brand-blue-dark",
    "brand-orange-ink",
    "ink",
    "ink-muted",
    "success",
    "danger",
  ];

  it.each(textColors)("%s on white", (name) => {
    expect(contrastRatio(colors[name], WHITE)).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
  });
});

describe("solid fills keep white text readable", () => {
  // Buttons and badges use these as backgrounds behind white text.
  const fills = ["brand-blue", "brand-blue-dark", "brand-orange-ink"];

  it.each(fills)("white text on %s", (name) => {
    expect(contrastRatio(WHITE, colors[name])).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
  });
});

describe("accent orange is constrained to non-text use", () => {
  it("is visible enough for borders, icons and decoration", () => {
    expect(contrastRatio(colors["brand-orange"], WHITE)).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });

  it("documents why it must not carry body text", () => {
    // Pinning the known-bad ratio makes the constraint explicit rather than
    // tribal knowledge: if someone brightens the orange further, this fails.
    expect(contrastRatio(colors["brand-orange"], WHITE)).toBeLessThan(
      AA_BODY_TEXT,
    );
  });
});

describe("accent text over the brand blue", () => {
  // The rest of the palette assumes dark text on white. The social sharing
  // image reverses that, and got caught once: against the old royal blue the
  // accent orange sat at 1.88:1 — legible to nobody.
  //
  // The logo's navy fixed that on its own, and this test now pins the new
  // fact rather than the old one. Kept rather than deleted: it is the place
  // that would catch a lighter blue being introduced later, which would take
  // the orange back below the line without anybody looking.
  it("the accent orange became readable on the navy", () => {
    expect(
      contrastRatio(colors["brand-orange"], colors["brand-blue"]),
    ).toBeGreaterThanOrEqual(AA_BODY_TEXT);
  });

  it("and the on-blue variant is more readable still, which is why it stays", () => {
    // Small text on a dark panel wants more than the minimum. The variant is
    // no longer a necessity, it is a comfort — and the assertion says which.
    expect(
      contrastRatio(colors["brand-orange-on-blue"], colors["brand-blue"]),
    ).toBeGreaterThan(
      contrastRatio(colors["brand-orange"], colors["brand-blue"]),
    );
  });

  it("the on-blue variant is readable as large text", () => {
    expect(
      contrastRatio(colors["brand-orange-on-blue"], colors["brand-blue"]),
    ).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it("and is NOT to be used on white", () => {
    // Named for where it belongs, and pinned here so the name stays true.
    expect(contrastRatio(colors["brand-orange-on-blue"], WHITE)).toBeLessThan(
      AA_NON_TEXT,
    );
  });
});

describe("state colours cannot be told apart by colour alone", () => {
  it("success and danger sit at near-identical luminance", () => {
    // Green and red are the classic red/green deficiency pair, and here they
    // are also close in luminance (~1.3:1) — which means a participant with
    // deuteranopia cannot separate "réussi" from "manqué" by colour.
    //
    // This is asserted, not fixed: darkening one of them would break its own
    // 4.5:1 ratio against white. The real answer is that every state also
    // carries an icon and a word — see the test below and AC 6.
    expect(contrastRatio(colors["success"], colors["danger"])).toBeLessThan(3);
  });

  it("every challenge state carries a distinct text label", () => {
    const labels = Object.values(CHALLENGE_STATUS_LABELS);

    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(3);
    labels.forEach((label) => expect(label.trim().length).toBeGreaterThan(0));
  });
});
