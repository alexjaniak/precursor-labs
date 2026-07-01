import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  filletPinchCompoundPathData,
  type Dot,
  type FilletPinchParams,
  type FilletPinchPathData,
} from "../src/graphics/fillet-pinch.ts";

type BannerParams = FilletPinchParams & {
  dotColor: string;
  backgroundColor: string;
};

const transparent = process.argv.includes("--transparent");
const seedArg = process.argv.find((arg) => arg.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.split("=")[1]) : 72;
const connectionSeedArg = process.argv.find((arg) => arg.startsWith("--connection-seed="));
const connectionSeed = connectionSeedArg ? Number(connectionSeedArg.split("=")[1]) : seed + 1009;

const outputPath = resolve(
  transparent
    ? "exports/liquid-dot-banner-transparent.svg"
    : "exports/liquid-dot-banner.svg",
);

// Banner canvas in grid units (1 unit = 1 lattice cell).
const COLS = 45;
const ROWS = 15;
const SVG_WIDTH = 3000;
const SVG_HEIGHT = 1000;
const SCALE = SVG_WIDTH / COLS;

const GRID_SPACING = 1;
const DOT_RADIUS = GRID_SPACING / 2.6;
const PINCH_RATIO = 0.8;
const MAX_FILL = 0.62;
const CONNECTION_CHANCE = 0.82;
const params = {
  unionMode: "all dots",
  pinchRatio: PINCH_RATIO,
  gridStep: GRID_SPACING,
  maxConnectionDistance: GRID_SPACING * 1.01,
  connectionChance: CONNECTION_CHANCE,
  connectionSeed,
  dotScale: 1,
  dotColor: "#fffdfa",
  backgroundColor: "#151414",
} satisfies BannerParams;

// Deterministic PRNG so banners are reproducible per seed.
function mulberry32(a: number): () => number {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(seed);

// Fill probability ramps up toward the right edge.
function fillChance(col: number): number {
  const t = col / (COLS - 1);
  const ramp = Math.min(1, Math.max(0, (t - 0.52) / 0.4));
  return MAX_FILL * ramp * ramp * (3 - 2 * ramp);
}

const dots: Dot[] = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    if (random() < fillChance(col)) {
      dots.push({ x: col + 0.5, y: row + 0.5, radius: DOT_RADIUS });
    }
  }
}

const field = filletPinchCompoundPathData(
  dots,
  params,
  (point) => ({
    x: point.x * SCALE,
    y: point.y * SCALE,
  }),
);

const background = transparent
  ? ""
  : `\n  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${params.backgroundColor}" />`;
const shape = transparent
  ? transparentShape(field)
  : opaqueShape(field);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" role="img" aria-label="Liquid dot banner">\n  <desc>Right-side random grid fillet-pinch dot banner, seed ${seed}, connection seed ${connectionSeed}, ${dots.length} dots, ${field.bridges.length} bridges.</desc>${background}${shape}\n</svg>\n`;

function opaqueShape(field: FilletPinchPathData): string {
  if (!field.positivePathData) return "";
  const cutouts = field.cutoutPathData
    ? `\n  <path d="${field.cutoutPathData}" fill="${params.backgroundColor}" />`
    : "";
  return `\n  <path d="${field.positivePathData}" fill="${params.dotColor}" fill-rule="nonzero" />${cutouts}`;
}

function transparentShape(field: FilletPinchPathData): string {
  return maskedShape(field);
}

function maskedShape(field: FilletPinchPathData): string {
  if (!field.positivePathData) return "";
  const maskId = "fillet-pinch-banner-mask";
  const cutouts = field.cutoutPathData
    ? `\n      <path d="${field.cutoutPathData}" fill="black" />`
    : "";
  return `
  <defs>
    <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}">
      <path d="${field.positivePathData}" fill="white" />${cutouts}
    </mask>
  </defs>
  <path d="${field.positivePathData}" fill="${params.dotColor}" fill-rule="nonzero" mask="url(#${maskId})" />`;
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`Seed: ${seed}`);
console.log(`Connection seed: ${connectionSeed}`);
console.log(`Connection chance: ${CONNECTION_CHANCE}`);
console.log(`Dots: ${dots.length}`);
console.log(`Bridges: ${field.bridges.length}`);
console.log(`Pinch arcs: ${field.fillets.length}`);
