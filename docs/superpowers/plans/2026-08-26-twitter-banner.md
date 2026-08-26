# Precursor Twitter Banner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a deterministic, upload-ready 1500 by 500 PNG that matches the Precursor Labs animated ASCII webpage background.

**Architecture:** Keep the field data and seeded text generation in one browser-safe ES module so Node tests can verify the same constants that the browser renders. Use one standalone HTML capture surface that imports the existing IBM Plex Mono package, renders at 2x, and is captured through the local Vite server. Reduce the 3000 by 1000 capture to the final 1500 by 500 PNG with `sips`.

**Tech Stack:** HTML, CSS, browser-native ES modules, Node test runner through `tsx`, Vite, IBM Plex Mono from `@fontsource`, Codex in-app browser, and macOS `sips`.

---

## Chunk 1: Deterministic source, browser surface, and PNG

### Task 1: Add the deterministic field model

**Files:**
- Create: `artifacts/precursor-twitter-banner.mjs`
- Test: `tests/twitter-banner.test.mjs`

- [ ] **Step 1: Write the failing source contract tests**

Create `tests/twitter-banner.test.mjs`. Import the future banner module and assert:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bannerModuleUrl = new URL(
  "../artifacts/precursor-twitter-banner.mjs",
  import.meta.url,
);
const loadBannerModule = () => import(bannerModuleUrl.href);
const readHtml = () =>
  readFileSync(
    new URL("../artifacts/precursor-twitter-banner.html", import.meta.url),
    "utf8",
  );

test("uses the approved canvas, type, and ASCII values", async () => {
  const banner = await loadBannerModule();

  assert.equal(banner.LOGICAL_WIDTH, 1500);
  assert.equal(banner.LOGICAL_HEIGHT, 500);
  assert.equal(banner.CAPTURE_SCALE, 2);
  assert.equal(banner.ROW_COUNT, 48);
  assert.equal(banner.COLUMN_COUNT, 220);
  assert.equal(banner.FONT_SIZE, 11);
  assert.equal(banner.LETTER_SPACING, 1);
  assert.equal(banner.ROW_GAP, 3);
  assert.equal(banner.PADDING_X, 12);
  assert.equal(banner.PADDING_Y, 10);
  assert.equal(banner.GLYPH_POOL, "$#%:;+=/\\[]{}*~?01<>^!-@&");
  assert.deepEqual(banner.ACTIVE_CLUSTERS, [
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
  ]);
  assert.deepEqual(banner.BRAND_WORDS, [
    { row: 5, start: 28, text: "PRECURSOR" },
    { row: 12, start: 146, text: "PRECURSOR" },
    { row: 18, start: 74, text: "PRECURSOR" },
    { row: 24, start: 175, text: "PRECURSOR" },
    { row: 29, start: 108, text: "PRECURSOR" },
  ]);
});

test("keeps all active clusters inside the logical canvas", async () => {
  const {
    ACTIVE_CLUSTERS,
    CHARACTER_ADVANCE,
    FONT_SIZE,
    LOGICAL_HEIGHT,
    LOGICAL_WIDTH,
    PADDING_X,
    PADDING_Y,
    ROW_ADVANCE,
  } = await loadBannerModule();

  for (const { length, row, start } of ACTIVE_CLUSTERS) {
    assert.ok(PADDING_X + (start + length) * CHARACTER_ADVANCE <= LOGICAL_WIDTH);
    assert.ok(PADDING_Y + row * ROW_ADVANCE + FONT_SIZE <= LOGICAL_HEIGHT);
  }
});

test("keeps every PRECURSOR word inside the X safe crop band", async () => {
  const { BRAND_WORDS, FONT_SIZE, PADDING_Y, ROW_ADVANCE } =
    await loadBannerModule();

  for (const { row } of BRAND_WORDS) {
    const top = PADDING_Y + row * ROW_ADVANCE;
    const bottom = top + FONT_SIZE;
    assert.ok(top >= 60, `row ${row} enters the top crop zone`);
    assert.ok(bottom <= 440, `row ${row} enters the bottom crop zone`);
  }
});

test("uses the approved deterministic seed and active offset", async () => {
  const { buildActiveText, GLYPH_POOL, glyphAt, seedFor } =
    await loadBannerModule();

  const expectedSeed =
    ((4 + 1) * 1103515245 +
      (9 + 1) * 12345 +
      4 * 9 * 2654435761) >>>
    0;
  assert.equal(seedFor(4, 9), expectedSeed);
  assert.equal(glyphAt(4, 9), GLYPH_POOL[expectedSeed % GLYPH_POOL.length]);
  assert.equal(buildActiveText(4, 9, 3).length, 3);
  assert.equal(buildActiveText(4, 9, 3)[0], glyphAt(4 + 97, 9 + 193));
});

test("defines the approved 2x browser capture surface", () => {
  const html = readHtml();
  assert.match(html, /width:\s*3000px/);
  assert.match(html, /height:\s*1000px/);
  assert.match(html, /width:\s*1500px/);
  assert.match(html, /height:\s*500px/);
  assert.match(html, /transform:\s*scale\(2\)/);
  assert.match(html, /rgb\(113 113 107 \/ 8%\)/);
  assert.match(html, /rgb\(101 159 88 \/ 25%\)/);
  assert.match(html, /rgb\(101 159 88 \/ 50%\)/);
  assert.match(html, /@fontsource\/ibm-plex-mono\/latin-400\.css/);
  assert.match(html, /document\.fonts\.ready/);
  assert.doesNotMatch(html, /box-shadow|gradient|animation|transition/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm exec tsx --test tests/twitter-banner.test.mjs`

Expected: FAIL because `artifacts/precursor-twitter-banner.mjs` and `artifacts/precursor-twitter-banner.html` do not exist.

- [ ] **Step 3: Add the minimal deterministic field module**

Create `artifacts/precursor-twitter-banner.mjs` with exported geometry, colors, fixed coordinates, and pure text helpers. Use these exact values and formulas:

```js
export const LOGICAL_WIDTH = 1500;
export const LOGICAL_HEIGHT = 500;
export const CAPTURE_SCALE = 2;
export const ROW_COUNT = 48;
export const COLUMN_COUNT = 220;
export const FONT_SIZE = 11;
export const LETTER_SPACING = 1;
export const ROW_GAP = 3;
export const PADDING_X = 12;
export const PADDING_Y = 10;
export const CHARACTER_ADVANCE = FONT_SIZE * 0.6 + LETTER_SPACING;
export const ROW_ADVANCE = FONT_SIZE + ROW_GAP;
export const GLYPH_POOL = "$#%:;+=/\\[]{}*~?01<>^!-@&";

export const ACTIVE_CLUSTERS = [
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

export const BRAND_WORDS = [
  { row: 5, start: 28, text: "PRECURSOR" },
  { row: 12, start: 146, text: "PRECURSOR" },
  { row: 18, start: 74, text: "PRECURSOR" },
  { row: 24, start: 175, text: "PRECURSOR" },
  { row: 29, start: 108, text: "PRECURSOR" },
];

export const seedFor = (row, column) =>
  ((row + 1) * 1103515245 +
    (column + 1) * 12345 +
    row * column * 2654435761) >>>
  0;

export const glyphAt = (row, column) =>
  GLYPH_POOL[seedFor(row, column) % GLYPH_POOL.length];

export const buildRowText = (row) =>
  Array.from({ length: COLUMN_COUNT }, (_, column) => glyphAt(row, column)).join("");

export const buildActiveText = (row, start, length) =>
  Array.from({ length }, (_, index) => glyphAt(row + 97, start + index + 193)).join("");
```

- [ ] **Step 4: Run the focused test and confirm only the HTML contract still fails**

Run: `pnpm exec tsx --test tests/twitter-banner.test.mjs`

Expected: the module assertions pass; the test file still fails because the HTML source is not present.

### Task 2: Add the 2x browser capture surface

**Files:**
- Create: `artifacts/precursor-twitter-banner.html`
- Test: `tests/twitter-banner.test.mjs`

- [ ] **Step 1: Build the standalone banner HTML**

Create `artifacts/precursor-twitter-banner.html` with this complete implementation:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Precursor Twitter Banner</title>
    <style>
      html,
      body {
        width: 3000px;
        height: 1000px;
        margin: 0;
        overflow: hidden;
        background: #fafafa;
      }

      .banner {
        box-sizing: border-box;
        width: 1500px;
        height: 500px;
        overflow: hidden;
        padding: 10px 12px;
        transform: scale(2);
        transform-origin: 0 0;
        background: #fafafa;
        color: rgb(113 113 107 / 8%);
        font-family: "IBM Plex Mono", monospace;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 1px;
        line-height: 1;
      }

      .banner-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .banner-row {
        height: 11px;
        white-space: pre;
      }

      .banner-active {
        color: rgb(101 159 88 / 25%);
      }

      .banner-brand {
        color: rgb(101 159 88 / 50%);
      }
    </style>
  </head>
  <body>
    <main class="banner" aria-label="Precursor Labs ASCII banner">
      <div class="banner-field" aria-hidden="true"></div>
    </main>
    <script type="module">
      import "@fontsource/ibm-plex-mono/latin-400.css";
      import {
        ACTIVE_CLUSTERS,
        BRAND_WORDS,
        buildActiveText,
        buildRowText,
        ROW_COUNT,
      } from "./precursor-twitter-banner.mjs";

      const field = document.querySelector(".banner-field");
      const activeByRow = new Map(
        ACTIVE_CLUSTERS.map((cluster) => [cluster.row, cluster]),
      );
      const brandByRow = new Map(BRAND_WORDS.map((word) => [word.row, word]));

      const appendOverlayRow = (rowElement, neutralText, overlay) => {
        const isBrand = "text" in overlay;
        const overlayText = isBrand
          ? overlay.text
          : buildActiveText(overlay.row, overlay.start, overlay.length);
        rowElement.append(document.createTextNode(neutralText.slice(0, overlay.start)));

        const overlayElement = document.createElement("span");
        overlayElement.className = isBrand ? "banner-brand" : "banner-active";
        overlayElement.textContent = overlayText;
        rowElement.append(overlayElement);
        rowElement.append(
          document.createTextNode(
            neutralText.slice(overlay.start + overlayText.length),
          ),
        );
      };

      for (let row = 0; row < ROW_COUNT; row += 1) {
        const rowElement = document.createElement("div");
        rowElement.className = "banner-row";
        const neutralText = buildRowText(row);
        const overlay = brandByRow.get(row) ?? activeByRow.get(row);

        if (overlay) {
          appendOverlayRow(rowElement, neutralText, overlay);
        } else {
          rowElement.textContent = neutralText;
        }

        field.append(rowElement);
      }

      await document.fonts.ready;
      document.documentElement.dataset.fontsReady = "true";
    </script>
  </body>
</html>
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run: `pnpm exec tsx --test tests/twitter-banner.test.mjs`

Expected: 5 tests pass.

- [ ] **Step 3: Run the full test and build suite**

Run: `pnpm test && pnpm build`

Expected: all tests pass and Vite completes a production build.

- [ ] **Step 4: Commit the deterministic source**

```bash
git add artifacts/precursor-twitter-banner.html artifacts/precursor-twitter-banner.mjs tests/twitter-banner.test.mjs
git commit -m "feat: add precursor twitter banner source"
```

### Task 3: Render and verify the PNG

**Files:**
- Create: `artifacts/precursor-twitter-banner.png`

- [ ] **Step 1: Start the worktree Vite server**

Run: `pnpm dev --host 127.0.0.1 --port 5174`

Expected: Vite serves the worktree at `http://127.0.0.1:5174/`.

- [ ] **Step 2: Capture the 2x browser surface**

Use `browser:control-in-app-browser`. Load its required instructions, then run these exact calls through its persistent JavaScript browser session:

```js
const { setupBrowserRuntime } = await import(
  "/Users/dylanvu/.codex/plugins/cache/openai-bundled/browser/26.820.60940/scripts/browser-client.mjs"
);
const agent = await setupBrowserRuntime();
const browser = await agent.browsers.getForUrl(
  "http://127.0.0.1:5174/artifacts/precursor-twitter-banner.html"
);
nodeRepl.write(await browser.documentation());
const viewport = await browser.capabilities.get("viewport");
nodeRepl.write(await viewport.documentation());
await viewport.set({ width: 3000, height: 1000 });
const tab = await browser.tabs.new();
await tab.goto(
  "http://127.0.0.1:5174/artifacts/precursor-twitter-banner.html"
);
await tab.playwright.waitForLoadState({ state: "networkidle", timeoutMs: 10000 });
await tab.playwright
  .locator('html[data-fonts-ready="true"]')
  .waitFor({ state: "attached", timeoutMs: 10000 });
```

Run this exact read-only browser evaluation and require every boolean in the result to be true:

```js
const verification = await tab.playwright.evaluate(() => {
  const rows = [...document.querySelectorAll(".banner-row")];
  const active = [...document.querySelectorAll(".banner-active")];
  const brands = [...document.querySelectorAll(".banner-brand")];
  const bannerStyle = getComputedStyle(document.querySelector(".banner"));
  const rowStyle = getComputedStyle(rows[0]);
  const activeStyle = getComputedStyle(active[0]);
  const brandStyle = getComputedStyle(brands[0]);
  const fontFaces = [...document.fonts];
  const insideCanvas = (element) => {
    const bounds = element.getBoundingClientRect();
    return (
      bounds.left >= 0 &&
      bounds.right <= 3000 &&
      bounds.top >= 0 &&
      bounds.bottom <= 1000
    );
  };

  return {
    activeBounds: active.length === 14 && active.every(insideCanvas),
    activeColor: activeStyle.color === "rgba(101, 159, 88, 0.25)",
    background: bannerStyle.backgroundColor === "rgb(250, 250, 250)",
    brandBounds:
      brands.length === 5 &&
      brands.every((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 120 && bounds.bottom <= 880 && insideCanvas(element);
      }),
    brandColor: brandStyle.color === "rgba(101, 159, 88, 0.5)",
    fontFaceLoaded: fontFaces.some(
      (face) => face.family.includes("IBM Plex Mono") && face.status === "loaded",
    ),
    fontFamily: bannerStyle.fontFamily.includes("IBM Plex Mono"),
    fontReady: document.fonts.check('400 11px "IBM Plex Mono"'),
    neutralColor: rowStyle.color === "rgba(113, 113, 107, 0.08)",
    rowCount: rows.length === 48,
    viewport:
      innerWidth === 3000 &&
      innerHeight === 1000 &&
      document.documentElement.scrollWidth === 3000 &&
      document.documentElement.scrollHeight === 1000,
  };
});
nodeRepl.write(verification);
```

Capture the exact viewport, write it to the fixed temporary path, and reset the viewport:

```js
const fileSystem = await import("node:fs/promises");
const screenshot = await tab.screenshot({ fullPage: false });
await fileSystem.writeFile("/tmp/precursor-twitter-banner@2x.png", screenshot);
await viewport.reset();
```

- [ ] **Step 3: Verify and normalize the 2x capture**

Run:

```bash
sips -g pixelWidth -g pixelHeight /tmp/precursor-twitter-banner@2x.png
```

Expected: `pixelWidth: 3000` and `pixelHeight: 1000`.

If the browser reports any other raster dimensions because of device pixel ratio, normalize the fixed temporary file before final reduction:

```bash
sips -z 1000 3000 /tmp/precursor-twitter-banner@2x.png --out /tmp/precursor-twitter-banner@2x-normalized.png
mv /tmp/precursor-twitter-banner@2x-normalized.png /tmp/precursor-twitter-banner@2x.png
```

Re-run the `sips -g` check and require exactly 3000 by 1000.

- [ ] **Step 4: Reduce the capture to the upload dimensions**

Run:

```bash
sips -z 500 1500 /tmp/precursor-twitter-banner@2x.png --out artifacts/precursor-twitter-banner.png
```

Expected: `artifacts/precursor-twitter-banner.png` is created.

- [ ] **Step 5: Verify exact dimensions and inspect the image**

Run:

```bash
sips -g pixelWidth -g pixelHeight artifacts/precursor-twitter-banner.png
```

Expected: `pixelWidth: 1500` and `pixelHeight: 500`.

Open the PNG at original detail. Confirm the field fills the canvas, the neutral ASCII remains subtle, active clusters read as 25% green, five PRECURSOR words read as 50% green, and no word enters the 60px top or bottom crop zone.

- [ ] **Step 6: Re-run all automated checks**

Run: `pnpm test && pnpm build`

Expected: all tests pass and Vite completes a production build.

- [ ] **Step 7: Commit the final PNG**

```bash
git add artifacts/precursor-twitter-banner.png
git commit -m "feat: render precursor twitter banner"
```
