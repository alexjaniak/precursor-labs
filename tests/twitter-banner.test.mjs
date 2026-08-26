import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACTIVE_CLUSTERS,
  BRAND_WORDS,
  CAPTURE_SCALE,
  CHARACTER_ADVANCE,
  COLUMN_COUNT,
  FONT_SIZE,
  GLYPH_POOL,
  LETTER_SPACING,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PADDING_X,
  PADDING_Y,
  ROW_ADVANCE,
  ROW_COUNT,
  ROW_GAP,
  buildActiveText,
  buildRowText,
  glyphAt,
  seedFor,
} from "../artifacts/precursor-twitter-banner.mjs";

const EXPECTED_ACTIVE_CLUSTERS = [
  { row: 0, start: 172, length: 17 },
  { row: 2, start: 12, length: 16 },
  { row: 4, start: 141, length: 22 },
  { row: 7, start: 49, length: 12 },
  { row: 10, start: 99, length: 26 },
  { row: 13, start: 22, length: 19 },
  { row: 15, start: 163, length: 18 },
  { row: 21, start: 128, length: 18 },
  { row: 23, start: 4, length: 24 },
  { row: 26, start: 93, length: 16 },
  { row: 28, start: 154, length: 20 },
  { row: 31, start: 40, length: 22 },
  { row: 33, start: 63, length: 21 },
  { row: 34, start: 110, length: 13 },
];

const EXPECTED_BRAND_WORDS = [
  { row: 5, start: 28, text: "PRECURSOR" },
  { row: 12, start: 146, text: "PRECURSOR" },
  { row: 18, start: 74, text: "PRECURSOR" },
  { row: 24, start: 175, text: "PRECURSOR" },
  { row: 29, start: 108, text: "PRECURSOR" },
];

const expectedSeedFor = (row, column) =>
  ((row + 1) * 1103515245 +
    (column + 1) * 12345 +
    row * column * 2654435761) >>>
  0;

test("exports the exact approved banner constants and placements", () => {
  assert.equal(LOGICAL_WIDTH, 1500);
  assert.equal(LOGICAL_HEIGHT, 500);
  assert.equal(CAPTURE_SCALE, 2);
  assert.equal(ROW_COUNT, 48);
  assert.equal(COLUMN_COUNT, 194);
  assert.equal(FONT_SIZE, 11);
  assert.equal(LETTER_SPACING, 1);
  assert.equal(ROW_GAP, 3);
  assert.equal(PADDING_X, 12);
  assert.equal(PADDING_Y, 10);
  assert.equal(CHARACTER_ADVANCE, FONT_SIZE * 0.6 + LETTER_SPACING);
  assert.equal(ROW_ADVANCE, FONT_SIZE + ROW_GAP);
  assert.equal(GLYPH_POOL, "$#%:;+=/\\[]{}*~?01<>^!-@&");
  assert.deepEqual(ACTIVE_CLUSTERS, EXPECTED_ACTIVE_CLUSTERS);
  assert.deepEqual(BRAND_WORDS, EXPECTED_BRAND_WORDS);
});

test("keeps every active cluster inside the logical banner", () => {
  for (const cluster of ACTIVE_CLUSTERS) {
    const left = PADDING_X + cluster.start * CHARACTER_ADVANCE;
    const right = left + cluster.length * CHARACTER_ADVANCE;
    const top = PADDING_Y + cluster.row * ROW_ADVANCE;
    const bottom = top + FONT_SIZE;

    assert.ok(left >= PADDING_X, `row ${cluster.row} starts before the content area`);
    assert.ok(
      right <= LOGICAL_WIDTH,
      `row ${cluster.row} extends beyond the banner`,
    );
    assert.ok(top >= PADDING_Y, `row ${cluster.row} starts above the content area`);
    assert.ok(
      bottom <= LOGICAL_HEIGHT,
      `row ${cluster.row} extends below the banner`,
    );
  }
});

test("keeps every PRECURSOR word within the approved vertical band", () => {
  for (const word of BRAND_WORDS) {
    const top = PADDING_Y + word.row * ROW_ADVANCE;
    const bottom = top + FONT_SIZE;

    assert.ok(top >= 60, `row ${word.row} starts above y=60`);
    assert.ok(bottom <= 440, `row ${word.row} extends below y=440`);
  }
});

test("generates deterministic neutral and active glyph text", () => {
  for (const [row, column] of [
    [0, 0],
    [7, 19],
    [47, 219],
  ]) {
    const expectedSeed = expectedSeedFor(row, column);
    assert.equal(seedFor(row, column), expectedSeed);
    assert.equal(glyphAt(row, column), GLYPH_POOL[expectedSeed % GLYPH_POOL.length]);
  }

  const row = 12;
  const rowText = buildRowText(row);
  assert.equal(rowText.length, COLUMN_COUNT);
  assert.equal(
    rowText,
    Array.from(
      { length: COLUMN_COUNT },
      (_, column) => GLYPH_POOL[expectedSeedFor(row, column) % GLYPH_POOL.length],
    ).join(""),
  );

  const activeRow = 5;
  const activeStart = 160;
  const activeLength = 22;
  const activeText = buildActiveText(activeRow, activeStart, activeLength);
  assert.equal(activeText.length, activeLength);
  assert.equal(
    activeText,
    Array.from(
      { length: activeLength },
      (_, index) =>
        GLYPH_POOL[
          expectedSeedFor(activeRow + 97, activeStart + index + 193) % GLYPH_POOL.length
        ],
    ).join(""),
  );
});

test("defines the exact static HTML rendering contract", async () => {
  const html = await readFile(
    new URL("../artifacts/precursor-twitter-banner.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /html,\s*body\s*\{[^}]*width:\s*3000px[^}]*height:\s*1000px[^}]*margin:\s*0[^}]*overflow:\s*hidden[^}]*background:\s*#FAFAFA/s);
  assert.match(html, /\.banner\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*1500px[^}]*height:\s*500px[^}]*overflow:\s*hidden[^}]*padding:\s*10px 12px[^}]*transform:\s*scale\(2\)[^}]*transform-origin:\s*0 0[^}]*background:\s*#FAFAFA[^}]*color:\s*rgb\(113 113 107 \/ 8%\)[^}]*font-family:\s*"IBM Plex Mono",\s*monospace[^}]*font-size:\s*11px[^}]*font-weight:\s*400[^}]*letter-spacing:\s*1px[^}]*line-height:\s*1/s);
  assert.match(html, /\.banner-field\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*3px/s);
  assert.match(html, /\.banner-row\s*\{[^}]*height:\s*11px[^}]*white-space:\s*pre/s);
  assert.match(html, /\.banner-active\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 25%\)/s);
  assert.match(html, /\.banner-brand\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 50%\)/s);
  assert.match(html, /<main class="banner" aria-label="Precursor Labs ASCII banner">\s*<div class="banner-field" aria-hidden="true"><\/div>\s*<\/main>/s);
  assert.match(html, /import\s+"@fontsource\/ibm-plex-mono\/latin-400\.css"/);
  assert.match(html, /from\s+"\.\/precursor-twitter-banner\.mjs"/);
  assert.match(html, /new Map\(ACTIVE_CLUSTERS\.map\(/);
  assert.match(html, /new Map\(BRAND_WORDS\.map\(/);
  assert.match(html, /for\s*\(let row = 0; row < ROW_COUNT; row \+= 1\)/);
  assert.match(html, /brandByRow\.get\(row\) \?\? activeByRow\.get\(row\)/);
  assert.match(html, /buildRowText\(row\)/);
  assert.match(html, /buildActiveText\(row, active\.start, active\.length\)/);
  assert.match(html, /brand\.text/);
  assert.match(html, /document\.createTextNode/);
  assert.match(html, /\.textContent\s*=/);
  assert.match(html, /document\.fonts\.ready/);
  assert.match(html, /document\.documentElement\.dataset\.fontsReady\s*=\s*"true"/);
  assert.doesNotMatch(
    html,
    /\b(?:border(?:-[a-z-]+)?|box-shadow|text-shadow)\s*:/i,
  );
  assert.doesNotMatch(html, /\bdrop-shadow\s*\(/i);
  assert.doesNotMatch(html, /<(?:img|picture|svg|canvas)\b/i);
  assert.doesNotMatch(
    html,
    /(?:class|id)\s*=\s*["'][^"']*\b(?:logo|mark|terminal|window)\b[^"']*["']/i,
  );
  assert.doesNotMatch(html, /url\([^)]*\b(?:logo|mark)\b[^)]*\)/i);
  assert.doesNotMatch(html, /innerHTML|(?:linear-|radial-)?gradient|animation|transition/i);

  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  assert.ok(bodyMatch, "missing body");

  const bodyScripts = bodyMatch[1].match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  assert.equal(bodyScripts.length, 1, "body must contain one module script");

  const bodyWithoutScript = bodyMatch[1].replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    "",
  );
  assert.match(
    bodyWithoutScript,
    /^\s*<main class="banner" aria-label="Precursor Labs ASCII banner">\s*<div class="banner-field" aria-hidden="true"><\/div>\s*<\/main>\s*$/,
  );
});
