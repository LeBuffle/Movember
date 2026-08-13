/**
 * Turns the official logo into the two assets the application needs.
 *
 * The Product Owner supplied one JPEG: the full logo, wordmark included, on an
 * opaque white background. Two things had to happen to it, and doing them by
 * hand once is how a brand asset silently drifts from its source — hence a
 * script, run again whenever the logo changes.
 *
 * **The white becomes transparent.** A JPEG cannot carry transparency, so the
 * logo would otherwise sit in a white rectangle — invisible on a white page and
 * glaring on any tinted surface. The key is built from the darkest channel of
 * each pixel rather than from its luminance: luminance would make the orange
 * half-transparent, since orange is a light colour. On the two flat colours of
 * this logo the darkest channel is near zero, and on white it is near 255.
 *
 * **The mark is cut from the wordmark.** An application icon is read at 192
 * pixels on a phone: at that size "DÉFI" is three grey smudges, and it eats the
 * room of the part that stays recognisable. Every operating system writes the
 * name under the icon anyway. The cut is a crop of the official artwork — the
 * circle, the mountain, the moustache and the orange stride — so nothing is
 * redrawn and nothing is invented.
 *
 * Run after replacing `public/brand/logo-source.jpeg`:
 *
 *   npm install --no-save sharp
 *   node scripts/prepare-brand.mjs
 *
 * `sharp` is deliberately not a dependency: a native module of some weight,
 * needed a handful of times in the life of the project. Same arrangement as
 * `generate-icons.mjs`, which consumes what this script produces.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error(
    "sharp est introuvable.\n" +
      "Installez-le le temps de la génération :\n\n" +
      "  npm install --no-save sharp\n",
  );
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const source = path.join(brandDir, "logo-source.jpeg");

/* -------------------------------------------------------------------------
 * Keying out the white
 * ---------------------------------------------------------------------- */

/**
 * Below this, a pixel is fully opaque; above, fully transparent.
 *
 * The band between the two is what keeps the curves smooth: the source is a
 * JPEG, so the edge of every shape is a gradient a few pixels wide, and a hard
 * threshold would turn those curves into staircases.
 */
const OPAQUE_BELOW = 205;
const TRANSPARENT_ABOVE = 245;

/** The darkest channel — see the note at the top on why not luminance. */
function alphaFor(r, g, b) {
  const darkest = Math.min(r, g, b);

  if (darkest <= OPAQUE_BELOW) return 255;
  if (darkest >= TRANSPARENT_ABOVE) return 0;

  const ramp =
    (TRANSPARENT_ABOVE - darkest) / (TRANSPARENT_ABOVE - OPAQUE_BELOW);
  return Math.round(ramp * 255);
}

async function withTransparency(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i];
    out[i + 1] = data[i + 1];
    out[i + 2] = data[i + 2];
    out[i + 3] = alphaFor(data[i], data[i + 1], data[i + 2]);
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

/* -------------------------------------------------------------------------
 * Finding the ink
 * ---------------------------------------------------------------------- */

/**
 * The bounding box of what is drawn, and the empty band that separates the
 * mark from the wordmark.
 *
 * Measured rather than hard-coded: the day the logo is redrawn slightly wider,
 * a hand-written crop would slice through it, and nobody would notice until
 * the icon was on a phone.
 */
async function analyse(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const isInk = (x, y) => {
    const i = (y * width + x) * channels;
    return (data[i] + data[i + 1] + data[i + 2]) / 3 < 235;
  };

  const rowInk = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (isInk(x, y)) n++;
    rowInk.push(n);
  }

  const colInk = [];
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = 0; y < height; y++) if (isInk(x, y)) n++;
    colInk.push(n);
  }

  const firstRow = rowInk.findIndex((n) => n > 0);
  const lastRow = height - 1 - [...rowInk].reverse().findIndex((n) => n > 0);
  const firstCol = colInk.findIndex((n) => n > 0);
  const lastCol = width - 1 - [...colInk].reverse().findIndex((n) => n > 0);

  /* The widest blank band inside the drawing. On this logo it is the gutter
     between the moustache and the word, and it is the only place a cut can be
     made without touching either. */
  let widest = null;
  let start = null;

  for (let y = firstRow; y <= lastRow; y++) {
    if (rowInk[y] === 0 && start === null) start = y;
    if (rowInk[y] !== 0 && start !== null) {
      const band = { from: start, to: y - 1, height: y - start };
      if (!widest || band.height > widest.height) widest = band;
      start = null;
    }
  }

  if (!widest) {
    throw new Error(
      "Aucune bande vide trouvée entre la marque et le mot : le découpage " +
        "ne peut pas être fait sans risquer de couper dans le dessin.",
    );
  }

  /* The mark's own columns, measured over its rows only. The wordmark is
     narrower than the circle, so the full drawing's box would leave a band of
     empty pixels on either side of the icon — and an icon that does not fill
     its square looks shrunken next to the others on a home screen. */
  let markFirstCol = width;
  let markLastCol = 0;

  for (let y = firstRow; y < widest.from; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk(x, y)) continue;
      if (x < markFirstCol) markFirstCol = x;
      if (x > markLastCol) markLastCol = x;
    }
  }

  return {
    width,
    height,
    firstRow,
    lastRow,
    firstCol,
    lastCol,
    gutter: widest,
    markFirstCol,
    markLastCol,
  };
}

/* -------------------------------------------------------------------------
 * Génération
 * ---------------------------------------------------------------------- */

/** A little air around the drawing, so nothing touches the edge. */
const MARGIN = 12;

async function main() {
  const box = await analyse(source);
  const transparent = await withTransparency(source);
  const buffer = await transparent.png().toBuffer();

  await mkdir(brandDir, { recursive: true });

  const clamp = (value, max) => Math.max(0, Math.min(value, max));
  const written = [];

  /* The full logo, trimmed to its drawing. Header, e-mails, sharing image. */
  const logo = {
    left: clamp(box.firstCol - MARGIN, box.width),
    top: clamp(box.firstRow - MARGIN, box.height),
    width: 0,
    height: 0,
  };
  logo.width = clamp(box.lastCol + MARGIN, box.width - 1) - logo.left + 1;
  logo.height = clamp(box.lastRow + MARGIN, box.height - 1) - logo.top + 1;

  const logoPng = await sharp(buffer).extract(logo).png().toBuffer();
  await writeFile(path.join(brandDir, "logo.png"), logoPng);
  written.push(`public/brand/logo.png      ${logo.width}×${logo.height}`);

  /* The mark alone, cut in the gutter above the wordmark. The application
     icon, at every size. */
  const mark = {
    left: clamp(box.markFirstCol - MARGIN, box.width),
    top: logo.top,
    width: 0,
    height: 0,
  };
  mark.width = clamp(box.markLastCol + MARGIN, box.width - 1) - mark.left + 1;
  mark.height = clamp(box.gutter.from + MARGIN, box.height - 1) - mark.top + 1;

  const markPng = await sharp(buffer).extract(mark).png().toBuffer();

  await writeFile(path.join(brandDir, "marque.png"), markPng);
  written.push(`public/brand/marque.png    ${mark.width}×${mark.height}`);

  /* Web-sized copies. The full-resolution logo is a third of a megabyte —
     fine as a source for the icon generator, absurd in a page header that
     shows it forty pixels tall. Each size is cut for one use and rendered at
     roughly three times its display size, so it stays sharp on a phone
     screen without carrying pixels nobody will ever see. */
  for (const [name, height] of [
    ["logo-en-tete.png", 132], // header, shown at 44 px
    ["logo-web.png", 400], // e-mails and sign-in screens, shown at ~150 px
  ]) {
    const resized = await sharp(logoPng)
      .resize({ height, fit: "inside" })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(path.join(brandDir, name), resized);

    const meta = await sharp(resized).metadata();
    written.push(
      `public/brand/${name.padEnd(17)}${meta.width}×${meta.height}` +
        `  ${(resized.length / 1024).toFixed(1)} ko`,
    );
  }

  console.log(
    `Source : ${box.width}×${box.height}\n` +
      `Dessin : lignes ${box.firstRow}–${box.lastRow}, colonnes ${box.firstCol}–${box.lastCol}\n` +
      `Gouttière marque / mot : lignes ${box.gutter.from}–${box.gutter.to}\n`,
  );
  console.log(written.join("\n"));
}

await main();
