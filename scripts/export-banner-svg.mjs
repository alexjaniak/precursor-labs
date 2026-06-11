import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { marchingSquares } from "../src/logo-svg-export.js";

const transparent = process.argv.includes("--transparent");
const seedArg = process.argv.find((arg) => arg.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.split("=")[1]) : 72;

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

const DOT_RADIUS = 0.36;
const MAX_FILL = 0.62;
const params = {
  unionMode: "all dots",
  liquidBlend: 0.65,
  dotScale: 1,
  dotColor: "#fffdfa",
  backgroundColor: "#151414",
};

// Deterministic PRNG so banners are reproducible per seed.
function mulberry32(a) {
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
function fillChance(col) {
  const t = col / (COLS - 1);
  const ramp = Math.min(1, Math.max(0, (t - 0.52) / 0.4));
  return MAX_FILL * ramp * ramp * (3 - 2 * ramp);
}

const dots = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    if (random() < fillChance(col)) {
      dots.push({ x: col + 0.5, y: row + 0.5, radius: DOT_RADIUS });
    }
  }
}

const bounds = { minX: 0, minY: 0, maxX: COLS, maxY: ROWS };
const contours = marchingSquares(dots, params, bounds, 1400);

const pathData = contours
  .map((contour) => {
    const commands = contour.map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${format(point.x * SCALE)} ${format(point.y * SCALE)}`;
    });
    return `${commands.join(" ")} Z`;
  })
  .join(" ");

const background = transparent
  ? ""
  : `\n  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${params.backgroundColor}" />`;
const path = pathData
  ? `\n  <path d="${pathData}" fill="${params.dotColor}" fill-rule="evenodd" />`
  : "";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" role="img" aria-label="Liquid dot banner">\n  <desc>Right-side random grid liquid dot banner, seed ${seed}, ${dots.length} dots, ${contours.length} contours.</desc>${background}${path}\n</svg>\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`Seed: ${seed}`);
console.log(`Dots: ${dots.length}`);
console.log(`Contours: ${contours.length}`);

function format(value) {
  return Number(value.toFixed(2));
}
