import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readExport = (name) =>
  readFileSync(new URL(`../exports/${name}`, import.meta.url), "utf8");

const fieldBoundaryPath = "M48 60 C113 60 174 93 194 194";
const frontierPath = "M52 60 C113 60 174 93 194 190";
const fieldPath = `${fieldBoundaryPath} H48 Z`;
const axesPath = "M48 44 V194 H202";

test("exports the approved Pareto Inference mark geometry", () => {
  const primary = readExport("pareto-inference-mark.svg");
  const transparent = readExport("pareto-inference-mark-transparent.svg");

  for (const svg of [primary, transparent]) {
    assert.match(svg, /viewBox="0 0 240 240"/);
    assert.match(svg, new RegExp(fieldPath));
    assert.match(svg, new RegExp(frontierPath));
    assert.match(svg, new RegExp(axesPath));
    assert.match(svg, /#659F58/);
    assert.match(svg, /fill-opacity="0\.22"/);
    assert.match(
      svg,
      new RegExp(`d="${frontierPath}"[^>]*stroke-linecap="butt"`),
    );
    assert.doesNotMatch(svg, /gradient|filter|shadow|<text\b/i);

    const fieldIndex = svg.indexOf(`d="${fieldPath}"`);
    const frontierIndex = svg.indexOf(`d="${frontierPath}"`);
    const axesIndex = svg.indexOf(`d="${axesPath}"`);
    assert.ok(fieldIndex < frontierIndex, "the shaded field must be below the frontier");
    assert.ok(frontierIndex < axesIndex, "the axes must overlay the frontier");
  }

  assert.match(
    primary,
    /<rect x="8" y="8" width="224" height="224" rx="48" fill="#151414"\s*\/>/,
  );
  assert.match(primary, /stroke="#FFFDFA"/);

  assert.doesNotMatch(transparent, /<rect\b/);
  assert.match(transparent, /stroke="#151414"/);
});
