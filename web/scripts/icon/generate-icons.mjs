// App icons: the Ā mark (lib/wordmark.ts) in black on white for light mode
// and in white on black for dark mode, after the user's two artworks
// (2026-09-30). Writes the website icon (the app icon itself: one SVG that
// follows the colour scheme, plus favicon.ico for browsers without SVG tab
// icons, such as Safari), the iOS home screen icons (full bleed, iOS rounds
// them itself) and the manifest icons (rounded, plus a full-bleed maskable
// one).
//
//   node scripts/icon/generate-icons.mjs        # from web/, needs Google Chrome
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const src = fs.readFileSync(path.join(WEB, "lib/wordmark.ts"), "utf8");
const MARK = src.match(/MARK_PATH = "([^"]+)"/)[1];
const MARK_W = Number(src.match(/^export const MARK_WIDTH = ([\d.]+)/m)[1]);
const MARK_H = Number(src.match(/^export const MARK_HEIGHT = ([\d.]+)/m)[1]);
// The welcome screen draws the mark with a 3-unit outline, which gives it
// the weight of the artwork; the icons do the same.
const STROKE = 3;

const THEMES = { light: { bg: "#FFFFFF", fg: "#000000" }, dark: { bg: "#000000", fg: "#FFFFFF" } };

/** The mark centred in a size×size square, `fill` = glyph height / side. */
function glyph(size, fill, cls = "", colour = "") {
  const k = (fill * size) / (MARK_H + STROKE);
  const tx = (size - MARK_W * k) / 2;
  const ty = (size - MARK_H * k) / 2;
  const paint = colour ? ` fill="${colour}" stroke="${colour}"` : "";
  return `<path${cls ? ` class="${cls}"` : ""}${paint} transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})" stroke-width="${STROKE}" stroke-linejoin="miter" d="${MARK}"/>`;
}

function svg(size, theme, { radius = 0, fill = FILL } = {}) {
  const { bg, fg } = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>${glyph(size, fill, "", fg)}</svg>`;
}

// The app icon's corner and glyph, so the website icon is the app icon:
// iOS rounds a home screen icon to about 22.5% of its side, and the glyph
// fills 46% of the height (user's artworks).
const RADIUS = 0.2246;
const FILL = 0.46;

// Website icon: one file, the scheme picks the colours.
const TAB = 512;
fs.writeFileSync(
  path.join(WEB, "public/icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TAB} ${TAB}">
<style>.bg{fill:${THEMES.light.bg}}.fg{fill:${THEMES.light.fg};stroke:${THEMES.light.fg}}@media (prefers-color-scheme:dark){.bg{fill:${THEMES.dark.bg}}.fg{fill:${THEMES.dark.fg};stroke:${THEMES.dark.fg}}}</style>
<rect class="bg" width="${TAB}" height="${TAB}" rx="${Math.round(TAB * RADIUS)}"/>
${glyph(TAB, FILL, "fg")}
</svg>
`,
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aura-icons-"));
function png(out, size, theme, opts) {
  const file = path.join(tmp, `${path.basename(out)}.svg`);
  fs.writeFileSync(file, svg(size, theme, opts));
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--window-size=${size},${size}`,
    `--screenshot=${path.join(WEB, out)}`,
    `file://${file}`,
  ], { stdio: "ignore" });
  if (!out.startsWith("..")) console.log("wrote", out);
}

for (const theme of ["light", "dark"]) {
  const suffix = theme === "dark" ? "-dark" : "";
  png(`public/apple-touch-icon${suffix}.png`, 180, theme);
  png(`public/icon-192${suffix}.png`, 192, theme, { radius: 43 });
  png(`public/icon-512${suffix}.png`, 512, theme, { radius: 115 });
  png(`public/icon-maskable-512${suffix}.png`, 512, theme);
}

// favicon.ico: the light app icon at 16, 32 and 48 px, each drawn at its
// own size (sharper than scaling one down), stored as PNGs inside the ICO.
const sizes = [16, 32, 48];
const images = sizes.map((size) => {
  const out = path.join(tmp, `favicon-${size}.png`);
  png(path.relative(WEB, out), size, "light", { radius: Math.round(size * RADIUS) });
  return fs.readFileSync(out);
});
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(size, at); // width
  header.writeUInt8(size, at + 1); // height
  header.writeUInt8(0, at + 2); // no palette
  header.writeUInt8(0, at + 3); // reserved
  header.writeUInt16LE(1, at + 4); // colour planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
fs.writeFileSync(path.join(WEB, "public/favicon.ico"), Buffer.concat([header, ...images]));
console.log("wrote public/favicon.ico");
fs.rmSync(tmp, { recursive: true, force: true });
