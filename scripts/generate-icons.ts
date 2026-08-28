/**
 * One-off PWA icon generator.
 *
 *   bun scripts/generate-icons.ts
 *
 * Rasterises the app mark (app/icon.svg) into the PNGs the web manifest and iOS
 * need. Outputs are committed, so this only needs re-running when the mark
 * changes. sharp is present transitively (via Next's image optimiser) and is
 * only used here, at author time, never at build or runtime.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");

// Gruvbox: the mark matches app/icon.svg.
const BG = "#282828";
const STROKE = "#fbf1c7";

/**
 * The mark is authored in a 32-unit box. Its ink (frame plus 1-unit stroke
 * overhang) spans x 1..31 and y 3..29, so half-extents are 15 x 13 units.
 */
const MARK_HALF_WIDTH = 15;
const MARK_HALF_HEIGHT = 13;

function mark(scale: number, size: number): string {
    // Centre the 32-unit box on the canvas.
    const offset = size / 2 - 16 * scale;
    return `
    <g transform="translate(${offset} ${offset}) scale(${scale})"
       fill="none" stroke="${STROKE}" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="28" height="24" rx="4" ry="4" />
      <path d="M8 12h4" />
      <path d="M16 12h.01" />
      <path d="M20 12h4" />
      <path d="M8 18h.01" />
      <path d="M12 18h8" />
      <path d="M24 18h.01" />
    </g>`;
}

/** Icon that browsers show as-authored: full-bleed rounded tile, generous inset. */
function anyIcon(size: number): string {
    const scale = (size * 0.78) / 32;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BG}" />
      ${mark(scale, size)}
    </svg>`;
}

/**
 * Maskable icon: the platform may crop to any shape inside the 80% safe circle,
 * so the mark is scaled until its corners fit that circle's radius.
 */
function maskableIcon(size: number): string {
    const safeRadius = size * 0.4;
    const markRadius = Math.hypot(MARK_HALF_WIDTH, MARK_HALF_HEIGHT);
    const scale = (safeRadius / markRadius) * 0.98;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${BG}" />
      ${mark(scale, size)}
    </svg>`;
}

/** iOS applies its own corner mask over an opaque square. */
function appleIcon(size: number): string {
    const scale = (size * 0.72) / 32;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${BG}" />
      ${mark(scale, size)}
    </svg>`;
}

const TARGETS = [
    { path: "public/icon-192.png", svg: anyIcon(192) },
    { path: "public/icon-512.png", svg: anyIcon(512) },
    { path: "public/icon-maskable-192.png", svg: maskableIcon(192) },
    { path: "public/icon-maskable-512.png", svg: maskableIcon(512) },
    { path: "app/apple-icon.png", svg: appleIcon(180) },
];

for (const target of TARGETS) {
    const outPath = join(ROOT, target.path);
    await mkdir(dirname(outPath), { recursive: true });
    await sharp(Buffer.from(target.svg)).png({ compressionLevel: 9 }).toFile(outPath);
    console.info(`wrote ${target.path}`);
}
