import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exportLogoToSvg } from "../src/logo-svg-export.js";

const transparent = process.argv.includes("--transparent");
const outputPath = resolve(
  transparent
    ? "exports/liquid-dot-logo-default-transparent.svg"
    : "exports/liquid-dot-logo-default.svg",
);

const squareStep = 0.115;
const DOT_RADIUS = squareStep / 2.6;
const DOT_SCALE = 1;
const PINCH_RATIO = 0.8;

const dots = [
  makeDot("pixel upper left", -1, 1, "custom A"),
  makeDot("pixel upper right", 1, 1, "custom A"),
  makeDot("pixel center", 0, 0, "custom A"),
  makeDot("pixel center right", 1, 0, "custom A"),
  makeDot("pixel lower center", 0, -1, "custom A"),
];

const params = {
  unionMode: "custom groups",
  pinchRatio: PINCH_RATIO,
  maxConnectionDistance: squareStep * 1.01,
  dotScale: DOT_SCALE,
  dotColor: "#fffdfa",
  backgroundColor: "#151414",
};

const { svg, geometry, bounds } = exportLogoToSvg(dots, params, {
  includeBackground: !transparent,
  size: 1024,
  padding: 0.08,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`Balls: ${geometry.balls.length}`);
console.log(`Bridges: ${geometry.bridges.length}`);
console.log(`Pinch arcs: ${geometry.fillets.length}`);
console.log(
  `World bounds: ${bounds.minX.toFixed(4)}, ${bounds.minY.toFixed(4)} to ${bounds.maxX.toFixed(4)}, ${bounds.maxY.toFixed(4)}`,
);

function makeDot(name, gridX, gridY, blend) {
  return {
    name,
    x: gridX * squareStep,
    y: gridY * squareStep,
    radius: DOT_RADIUS,
    blend,
  };
}
