import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { filletPinchCompoundPathData } from "../src/fillet-pinch.js";

const WIDTH = 1600;
const HEIGHT = 900;
const outputPath = resolve("exports/precursor-labs-launch-x-banner.svg");
const pngOutputPath = resolve("exports/precursor-labs-launch-x-banner.png");
const titleFontPath = resolve("public/fonts/MajorMonoDisplay-Regular.ttf");

const colors = {
  paper: "#151414",
  ink: "#fffdfa",
};

const CONNECTION_CHANCE = 0.82;
const connectionSeed = 1228;
const GRID_SPACING = 1;
const DOT_RADIUS = GRID_SPACING / 2.6;
const PINCH_RATIO = 0.8;

const params = {
  unionMode: "all dots",
  pinchRatio: PINCH_RATIO,
  gridStep: GRID_SPACING,
  maxConnectionDistance: GRID_SPACING * 1.01,
  connectionChance: CONNECTION_CHANCE,
  connectionSeed,
  dotScale: 1,
};

const rightField = liquidField({
  x: 690,
  y: 54,
  cols: 27,
  rows: 18,
  cell: 47,
  seed: 219,
  fillMax: 0.82,
  rampStart: 0.06,
  dotRadius: DOT_RADIUS,
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Precursor Labs launch banner">
  <desc>Minimal launch image for Precursor Labs using the fillet-pinch dot visual language.</desc>
  <defs>
    <linearGradient id="fade-left" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${colors.paper}" stop-opacity="0.98" />
      <stop offset="0.5" stop-color="${colors.paper}" stop-opacity="0.62" />
      <stop offset="1" stop-color="${colors.paper}" stop-opacity="0" />
    </linearGradient>
    <style>
      @font-face {
        font-family: MajorMonoDisplay;
        src: url("../public/fonts/MajorMonoDisplay-Regular.ttf") format("truetype");
      }
      .title {
        font-family: MajorMonoDisplay;
        font-weight: 400;
        letter-spacing: 0;
      }
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.paper}" />
  <path d="${rightField.positivePathData}" fill="${colors.ink}" fill-rule="nonzero" />
  <path d="${rightField.cutoutPathData}" fill="${colors.paper}" />
  <rect x="0" y="0" width="880" height="${HEIGHT}" fill="url(#fade-left)" />

  <g>
    <text x="92" y="365" class="title" fill="${colors.ink}" font-size="78">Precursor</text>
    <text x="92" y="470" class="title" fill="${colors.ink}" font-size="78">Labs</text>
  </g>
</svg>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`Connection seed: ${connectionSeed}`);
console.log(`Connection chance: ${CONNECTION_CHANCE}`);
console.log(`Dots: ${rightField.dots}`);
console.log(`Bridges: ${rightField.bridges}`);
console.log(`Pinch arcs: ${rightField.fillets}`);

const pngExport = spawnSync("magick", [
  outputPath,
  "-fill",
  colors.paper,
  "-draw",
  "rectangle 0,0 880,900",
  "-font",
  titleFontPath,
  "-pointsize",
  "78",
  "-fill",
  colors.ink,
  "-annotate",
  "+92+365",
  "Precursor",
  "-annotate",
  "+92+470",
  "Labs",
  "-strip",
  pngOutputPath,
], { encoding: "utf8" });

if (pngExport.status !== 0) {
  throw new Error(pngExport.stderr || "Failed to render launch banner PNG with ImageMagick.");
}

console.log(`Wrote ${pngOutputPath}`);

function liquidField(options) {
  const {
    x,
    y,
    cols,
    rows,
    cell,
    seed,
    dotRadius,
    fillMax = 1,
    rampStart = 0,
    fixedDots,
  } = options;
  const random = mulberry32(seed);
  const dots = [];

  if (fixedDots) {
    fixedDots.forEach(([col, row]) => {
      dots.push({ x: col + 0.5, y: row + 0.5, radius: dotRadius });
    });
  } else {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tx = col / Math.max(1, cols - 1);
        const ty = row / Math.max(1, rows - 1);
        const centerBias = 1 - Math.min(0.78, Math.abs(ty - 0.5) * 0.9);
        const ramp = smoothstep(rampStart, 1, tx);
        const island = 0.72 + 0.28 * Math.sin((tx * 2.7 + ty * 1.8) * Math.PI);
        if (random() < fillMax * ramp * centerBias * island) {
          dots.push({ x: col + 0.5, y: row + 0.5, radius: dotRadius });
        }
      }
    }
  }

  const field = filletPinchCompoundPathData(
    dots,
    params,
    (point) => ({
      x: x + point.x * cell,
      y: y + point.y * cell,
    }),
  );

  return {
    pathData: field.pathData,
    positivePathData: field.positivePathData,
    cutoutPathData: field.cutoutPathData,
    dots: field.balls.length,
    bridges: field.bridges.length,
    fillets: field.fillets.length,
  };
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
