/**
 * Generates the application icon set from the official logo.
 *
 * Why a script rather than hand-made files: an icon set is nine images that
 * must stay identical to each other. Redrawing one of them by hand after a
 * change of logo is how a set drifts. Here the artwork lives in one place —
 * `public/brand/`, produced by `prepare-brand.mjs` from the JPEG the Product
 * Owner supplied — and every size is a render of that single source.
 *
 * **The icons use the mark, the sharing image uses the full logo.** An icon is
 * read at 192 pixels on a phone, where the word "DÉFI" is three grey smudges
 * that eat the room of the part that stays recognisable; the operating system
 * writes the name underneath anyway. A link preview is read at 1200 pixels,
 * where the word is the whole point.
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
    orangeOnBlue: read("brand-orange-on-blue"),
  };
}

/* -------------------------------------------------------------------------
 * The mark
 * ---------------------------------------------------------------------- */

const brandDir = path.join(root, "public", "brand");
const markFile = path.join(brandDir, "marque.png");
const logoFile = path.join(brandDir, "logo.png");

/**
 * How far the ink reaches from the centre of the mark, as a fraction of half
 * its longest side.
 *
 * Measured rather than assumed, and that is what lets the icon fill its
 * square. The naive check — "does the bounding box fit inside the safe
 * circle" — treats the corners of the box as if they were drawn on. They are
 * not: this mark is a circle, so its corners are empty, and trusting the box
 * would shrink the icon by a third for nothing.
 */
async function inkRadius(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const centreX = width / 2;
  const centreY = height / 2;

  let furthest = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Anything but a fully transparent pixel counts: a faint anti-aliased
      // edge is still visible once the icon is cropped through it.
      if (data[(y * width + x) * 4 + 3] < 12) continue;

      const distance = Math.hypot(x - centreX, y - centreY);
      if (distance > furthest) furthest = distance;
    }
  }

  return { width, height, furthest };
}

/**
 * One square icon: the mark, centred on an opaque background.
 *
 * **Opaque, always.** A transparent icon shows the wallpaper through the gaps
 * of the drawing — and this mark has real gaps, between the moustache and the
 * circle. White is not a default here, it is the surface the logo was drawn
 * on.
 *
 * @param safeRadius the greatest distance from the centre the ink may reach,
 *   on a 512 grid. Android crops a maskable icon to whatever shape the
 *   launcher uses, and only the centred circle of 80 % diameter — radius
 *   204.8 — is guaranteed to survive.
 */
async function iconPng(mark, radius, background, size, safeRadius) {
  const CANVAS = 512;
  const scale = safeRadius / radius.furthest;

  const drawnWidth = Math.round(radius.width * scale);
  const drawnHeight = Math.round(radius.height * scale);

  const resized = await sharp(mark)
    .resize(drawnWidth, drawnHeight, { fit: "inside" })
    .png()
    .toBuffer();

  /* Two passes, and not by taste: sharp runs its resize BEFORE its composite
     whatever order they are called in. Chaining them would shrink the canvas
     to the target size first, then refuse to paste a mark larger than it. */
  const composed = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: resized,
        left: Math.round((CANVAS - drawnWidth) / 2),
        top: Math.round((CANVAS - drawnHeight) / 2),
      },
    ])
    .png()
    .toBuffer();

  return sharp(composed)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** `#rrggbb` to what sharp wants for a background. */
function rgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
    alpha: 1,
  };
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
 * Social sharing image
 * ---------------------------------------------------------------------- */

/**
 * The 1200×630 image shown when someone shares a link on a social network or
 * in a messaging app.
 *
 * Recruitment for this edition happens by sharing, so this image is not
 * decoration: it is what a link looks like in a group chat. Without one, the
 * link shows as a bare grey rectangle.
 *
 * The text is drawn into the image rather than composed at request time.
 * The result is a static file, served like any other, with nothing to render
 * per crawl — and crawlers are impatient.
 */
function socialTextSvg({ orangeOnBlue }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <text x="520" y="266" font-family="DejaVu Sans" font-size="68" font-weight="bold" fill="#ffffff">DEFI Movember</text>
  <text x="520" y="336" font-family="DejaVu Sans" font-size="38" fill="#ffffff" opacity="0.92">Un mois, un défi par jour,</text>
  <text x="520" y="386" font-family="DejaVu Sans" font-size="38" fill="#ffffff" opacity="0.92">une collection à compléter.</text>
  <text x="520" y="462" font-family="DejaVu Sans" font-size="26" fill="${orangeOnBlue}">Novembre 2026 · projet associatif indépendant</text>
</svg>`;
}

/**
 * The 1200×630 image shown when a link is shared.
 *
 * Recruitment for this edition happens by sharing, so this is not decoration:
 * it is what a link looks like in a group chat. Without one, the link shows as
 * a bare grey rectangle.
 *
 * The logo is composited rather than redrawn, and the text is baked in rather
 * than composed per request — the result is a static file with nothing to
 * render per crawl, and crawlers are impatient.
 */
async function socialImage(colours) {
  const WIDTH = 1200;
  const HEIGHT = 630;
  const LOGO_HEIGHT = 340;

  const logo = await sharp(logoFile)
    .resize({ height: LOGO_HEIGHT, fit: "inside" })
    .png()
    .toBuffer();

  const { width: logoWidth } = await sharp(logo).metadata();

  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colours.blue}"/>
      <stop offset="1" stop-color="${colours.blueDark}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
</svg>`,
  );

  /* The logo is navy on transparent, and the panel behind it is navy too. A
     white disc under it is what keeps the mark readable — the same white the
     logo was drawn on, rather than a lightened version of the background that
     would read as a printing error. */
  const plateSize = LOGO_HEIGHT + 72;
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plateSize}" height="${plateSize}">
  <circle cx="${plateSize / 2}" cy="${plateSize / 2}" r="${plateSize / 2}" fill="#ffffff"/>
</svg>`,
  );

  const plateLeft = 72;
  const plateTop = Math.round((HEIGHT - plateSize) / 2);

  /* Each layer is rendered to its final pixel size BEFORE being composited.
     sharp runs its resize before its composite whatever order they are called
     in, and an SVG rendered at a higher density comes out larger than the
     canvas it is meant to sit on — which it then refuses to paste. */
  const canvas = await sharp(background).resize(WIDTH, HEIGHT).png().toBuffer();

  const text = await sharp(Buffer.from(socialTextSvg(colours)), {
    density: 144,
  })
    .resize(WIDTH, HEIGHT)
    .png()
    .toBuffer();

  return sharp(canvas)
    .composite([
      { input: plate, left: plateLeft, top: plateTop },
      {
        input: logo,
        left: plateLeft + Math.round((plateSize - (logoWidth ?? 0)) / 2),
        top: plateTop + Math.round((plateSize - LOGO_HEIGHT) / 2),
      },
      { input: text, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* -------------------------------------------------------------------------
 * Generation
 * ---------------------------------------------------------------------- */

async function main() {
  const colours = await readBrandColours();
  await mkdir(iconsDir, { recursive: true });

  const mark = await readFile(markFile);
  const radius = await inkRadius(markFile);
  const white = rgb("#ffffff");

  /* Two coverages, and the difference between them is the whole reason there
     are two files. A launcher may crop a maskable icon to a circle, a squircle
     or a rounded square; only the centred circle of 80 % diameter survives all
     of them. The standard icon is not cropped, so it can breathe wider. */
  const STANDARD_RADIUS = 236;
  const MASKABLE_RADIUS = 204.8;

  const written = [];
  const write = async (name, data) => {
    await writeFile(path.join(iconsDir, name), data);
    written.push(`public/icons/${name}  ${(data.length / 1024).toFixed(1)} ko`);
  };

  const standard = (size) =>
    iconPng(mark, radius, white, size, STANDARD_RADIUS);
  const maskable = (size) =>
    iconPng(mark, radius, white, size, MASKABLE_RADIUS);

  for (const size of [192, 512]) {
    await write(`icon-${size}.png`, await standard(size));
    await write(`icon-maskable-${size}.png`, await maskable(size));
  }

  // iOS ignores the manifest icons and reads this one. It must be square and
  // fully opaque: iOS applies its own rounded mask, and a transparent corner
  // comes out black. Drawn at the maskable coverage for the same reason.
  await write("apple-touch-icon.png", await maskable(180));

  const ico = buildIco([
    { size: 32, data: await standard(32) },
    { size: 48, data: await standard(48) },
  ]);
  await writeFile(path.join(root, "src/app/favicon.ico"), ico);
  written.push(`src/app/favicon.ico  ${(ico.length / 1024).toFixed(1)} ko`);

  // Next serves this as the Open Graph image from its file name alone.
  const social = await socialImage(colours);
  await writeFile(path.join(root, "src/app/opengraph-image.png"), social);
  written.push(
    `src/app/opengraph-image.png  ${(social.length / 1024).toFixed(1)} ko`,
  );

  console.log(
    `Marque : ${radius.width}×${radius.height}, encre à ${radius.furthest.toFixed(0)} px du centre\n` +
      `Couleurs lues dans globals.css : ${colours.blue} / ${colours.orange}\n`,
  );
  console.log(written.join("\n"));
}

await main();
