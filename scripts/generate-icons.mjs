/**
 * Generates the application icon set from a single vector source.
 *
 * Why a script rather than hand-made files: an icon set is nine images that
 * must stay identical to each other. Redrawing one of them by hand after a
 * palette change is how a set drifts. Here the shape lives in one place, the
 * colours are read from `src/app/globals.css` — the same file the contrast
 * test reads — and every size is a render of that single source.
 *
 * The output is committed to the repository: it is a build input, not a build
 * artifact, and regenerating it on every deploy would be pure waste.
 *
 * Run it only after changing the mark or the brand colours:
 *
 *   npm install --no-save sharp
 *   node scripts/generate-icons.mjs
 *
 * `sharp` is deliberately NOT a dependency of the project. It is a native
 * module of some weight, needed a handful of times in the life of the
 * project, and adding it would slow down every CI run and every Docker build
 * for nothing.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const iconsDir = path.join(root, "public", "icons");

/* -------------------------------------------------------------------------
 * Brand colours — read from the stylesheet, never retyped
 * ---------------------------------------------------------------------- */

async function readBrandColours() {
  const css = await readFile(path.join(root, "src/app/globals.css"), "utf8");

  const read = (token) => {
    const match = css.match(
      new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{3,8})`),
    );
    if (!match)
      throw new Error(`Jeton de couleur introuvable : --color-${token}`);
    return match[1];
  };

  return {
    blue: read("brand-blue"),
    blueDark: read("brand-blue-dark"),
    orange: read("brand-orange"),
  };
}

/* -------------------------------------------------------------------------
 * The mark
 * ---------------------------------------------------------------------- */

/**
 * A handlebar moustache, drawn once on a 512 grid.
 *
 * Symmetrical around x = 256. Three features make it read as a moustache
 * rather than as a smile: a narrow V notch at the top centre (the philtrum),
 * flanks that are much thicker than the centre, and tips that flick up well
 * above the body. No Movember Foundation asset is involved: the shape is
 * drawn for this project (CLAUDE.md §5).
 */
const MOUSTACHE_PATH = [
  "M 256 236", // bottom of the philtrum notch
  "C 264 216, 282 204, 308 198",
  "C 350 188, 400 172, 436 148",
  "C 454 136, 468 140, 466 154", // right tip
  "C 463 174, 440 202, 410 226",
  "C 376 254, 330 282, 292 288",
  "C 278 290, 266 290, 256 286", // bottom centre
  "C 246 290, 234 290, 220 288",
  "C 182 282, 136 254, 102 226",
  "C 72 202, 49 174, 46 154", // left tip
  "C 44 140, 58 136, 76 148",
  "C 112 172, 162 188, 204 198",
  "C 230 204, 248 216, 256 236",
  "Z",
].join(" ");

/** Bounding box of the path above, used to centre and scale it. */
const MARK_BOX = { x: 44, y: 136, width: 424, height: 154 };

/**
 * @param scale size of the mark relative to its own drawing, once recentred
 *   on the canvas. Full-bleed icons can use most of the surface; a maskable
 *   icon cannot — Android crops it to whatever shape the launcher uses, and
 *   only the centred circle of 80% diameter is guaranteed to survive.
 *   Keeping the mark inside that circle is the whole point of a separate
 *   maskable file, and `assertInsideSafeZone` below checks it rather than
 *   trusting the eye.
 */
function markSvg({ blue, blueDark, orange }, scale) {
  const centreX = MARK_BOX.x + MARK_BOX.width / 2;
  const centreY = MARK_BOX.y + MARK_BOX.height / 2;
  const dx = 256 - scale * centreX;
  const dy = 256 - scale * centreY;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${blue}"/>
      <stop offset="1" stop-color="${blueDark}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale})">
    <path d="${MOUSTACHE_PATH}" fill="${orange}"/>
  </g>
</svg>`;
}

/**
 * Fails the generation if the maskable mark could be clipped.
 *
 * The safe zone is the centred circle of 80% of the canvas — radius 204.8 on
 * a 512 grid. A launcher may crop anything outside it. Checking the corner of
 * the bounding box is conservative and that is what we want here: a clipped
 * icon is only noticed once it is on someone's home screen.
 */
function assertInsideSafeZone(scale) {
  const halfDiagonal =
    (scale * Math.hypot(MARK_BOX.width, MARK_BOX.height)) / 2;

  if (halfDiagonal > 204.8) {
    throw new Error(
      `Icône masquable trop grande : demi-diagonale ${halfDiagonal.toFixed(1)} > 204.8`,
    );
  }
}

/* -------------------------------------------------------------------------
 * ICO — assembled by hand
 * ---------------------------------------------------------------------- */

/**
 * Wraps PNGs in an ICO container.
 *
 * sharp cannot write .ico, and pulling in a second image library for a
 * 22-byte header is not worth it. Modern browsers accept PNG payloads inside
 * an ICO, so each entry is simply a whole PNG file.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size, 0 for true colour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

/* -------------------------------------------------------------------------
 * Generation
 * ---------------------------------------------------------------------- */

async function main() {
  const colours = await readBrandColours();
  await mkdir(iconsDir, { recursive: true });

  const MASKABLE_SCALE = 0.8;
  assertInsideSafeZone(MASKABLE_SCALE);

  const standard = Buffer.from(markSvg(colours, 0.92));
  const maskable = Buffer.from(markSvg(colours, MASKABLE_SCALE));

  const png = (svg, size) =>
    sharp(svg, { density: 512 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();

  const written = [];
  const write = async (name, data) => {
    await writeFile(path.join(iconsDir, name), data);
    written.push(`public/icons/${name}  ${(data.length / 1024).toFixed(1)} ko`);
  };

  for (const size of [192, 512]) {
    await write(`icon-${size}.png`, await png(standard, size));
    await write(`icon-maskable-${size}.png`, await png(maskable, size));
  }

  // iOS ignores the manifest icons and reads this one. It must be square and
  // fully opaque: iOS applies its own rounded mask, and a transparent corner
  // comes out black.
  await write("apple-touch-icon.png", await png(standard, 180));

  // Vector version, used by browsers that prefer it and by anything that
  // needs to scale the mark past 512.
  await write("icon.svg", standard);

  const ico = buildIco([
    { size: 32, data: await png(standard, 32) },
    { size: 48, data: await png(standard, 48) },
  ]);
  await writeFile(path.join(root, "src/app/favicon.ico"), ico);
  written.push(`src/app/favicon.ico  ${(ico.length / 1024).toFixed(1)} ko`);

  console.log(
    `Couleurs lues dans globals.css : ${colours.blue} / ${colours.orange}\n`,
  );
  console.log(written.join("\n"));
}

await main();
