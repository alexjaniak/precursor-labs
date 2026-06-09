import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exportLogoToSvg } from "../src/logo-svg-export.js";

const transparent = process.argv.includes("--transparent");
const outputPath = resolve(
  transparent
    ? "exports/liquid-dot-logo-default-transparent.svg"
    : "exports/liquid-dot-logo-default.svg",
);

const dots = [
  makeDot("pixel upper left", -1, 1, 0.069, "custom A"),
  makeDot("pixel upper right", 1, 1, 0.069, "custom A"),
  makeDot("pixel center", 0, 0, 0.069, "custom A"),
  makeDot("pixel center right", 1, 0, 0.069, "custom A"),
  makeDot("pixel lower center", 0, -1, 0.069, "custom A"),
];

const params = {
  unionMode: "custom groups",
  liquidBlend: 0.06,
  dotScale: 0.733,
  dotColor: "#f4eee9",
  backgroundColor: "#1a1a1a",
};

const { svg, contours, bounds, resolution } = exportLogoToSvg(dots, params, {
  includeBackground: !transparent,
  resolution: 1024,
  size: 1024,
  padding: 0.08,
  simplifyTolerance: 0.00016,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`Contours: ${contours.length}`);
console.log(`Samples: ${resolution}x${resolution}`);
console.log(
  `World bounds: ${bounds.minX.toFixed(4)}, ${bounds.minY.toFixed(4)} to ${bounds.maxX.toFixed(4)}, ${bounds.maxY.toFixed(4)}`,
);

function makeDot(name, gridX, gridY, radius, blend) {
  const squareStep = 0.115;
  return {
    name,
    x: gridX * squareStep,
    y: gridY * squareStep,
    radius,
    blend,
  };
}
