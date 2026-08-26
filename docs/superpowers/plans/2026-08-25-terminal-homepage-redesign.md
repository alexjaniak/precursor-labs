# Terminal Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current logo-led, dual-theme homepage with one light-mode, centered, internally scrollable command transcript that contains the approved copy and credibility links.

**Architecture:** Keep the page static and semantic in `index.html`. Use `src/styles.css` for the complete terminal presentation and cursor motion, and reduce the TypeScript runtime to the two retained Mixpanel event bindings. Add a small Node test file that checks the static content, visual tokens, removed features, links, and analytics contract without adding a test framework.

**Tech Stack:** Vite 5, TypeScript, HTML, CSS, Node test runner, `@fontsource/ibm-plex-mono`, Mixpanel

---

## File Structure

- Create `tests/homepage.test.mjs`: source-level contract tests for transcript content, destinations, design tokens, removed controls, and analytics.
- Modify `package.json`: add the Node test command and IBM Plex Mono dependency.
- Modify `pnpm-lock.yaml`: lock the font dependency.
- Modify `index.html`: own the full semantic terminal transcript and retained metadata.
- Modify `src/styles.css`: own font loading, tokens, terminal layout, responsive rules, links, scrollbar, and cursor motion.
- Modify `src/main.ts`: bind only page-view and credibility-link analytics.
- Modify `src/analytics.ts`: expose only the retained event property types.
- Modify `AGENTS.md`: keep the Mixpanel tracking plan synchronized with the runtime.

## Chunk 1: Build and Verify the Terminal Homepage

### Task 1: Add the Failing Homepage Contract Tests

**Files:**
- Create: `tests/homepage.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a Node test command**

Add this script to `package.json`:

```json
"test": "node --test tests/*.test.mjs"
```

- [ ] **Step 2: Write the source contract tests**

Create `tests/homepage.test.mjs` with tests that read repository files and assert:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("src/styles.css");
const main = read("src/main.ts");
const analytics = read("src/analytics.ts");
const agents = read("AGENTS.md");

test("renders the approved command transcript and removes old controls", () => {
  const commands = [
    "precursor about",
    "precursor thesis",
    "precursor research",
    "precursor interests",
    "precursor backers",
    "precursor experience",
  ];

  for (const command of commands) {
    assert.match(html, new RegExp(command));
  }

  const commandOffsets = commands.map((command) => html.indexOf(command));
  assert.deepEqual(commandOffsets, [...commandOffsets].sort((a, b) => a - b));

  for (const text of [
    "Precursor Labs is a research company studying the organizing principles",
    "We believe the next generation of autonomous systems",
    "We are engineers, financiers, and company builders",
    "We are especially interested in partners working on interactive learning",
  ]) {
    assert.match(html, new RegExp(text));
  }

  assert.doesNotMatch(html, /themeToggle|logoMark|logoAnimation|header-social/);
  assert.match(html, /<meta name="theme-color" content="#FAFAFA" \/>/);
  assert.match(html, /class="final-prompt"[^>]*aria-hidden="true"/);
});

test("keeps the approved credibility destinations", () => {
  for (const destination of [
    "https://www.blockchaincapital.com/",
    "https://reforge.vc/",
    "https://www.blockchainbuilders.fund/",
    "https://aws.amazon.com/",
    "https://www.stanford.edu/",
    "https://www.northropgrumman.com/",
    "https://duke.edu/",
    "https://www.centerviewpartners.com/",
    "https://www.berkeley.edu/",
    "https://www.cornell.edu/",
    "https://www.harvard.edu/",
  ]) {
    const anchor = html
      .match(/<a[\s\S]*?<\/a>/g)
      ?.find((candidate) => candidate.includes(`href="${destination}"`));
    assert.ok(anchor, `missing link for ${destination}`);
    assert.match(anchor, /rel="noreferrer"/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /data-track-link-name="[a-z_]+"/);
    assert.match(anchor, /data-track-link-category="(?:backer|experience)"/);
  }
});

test("uses the approved visual system and responsive terminal", () => {
  for (const token of ["#FAFAFA", "#171717", "#71716B", "#659F58", "#E5E5E3"]) {
    assert.match(css, new RegExp(token, "i"));
  }
  assert.match(css, /IBM Plex Mono/);
  assert.match(css, /@fontsource\/ibm-plex-mono\/latin-400\.css/);
  assert.match(css, /@fontsource\/ibm-plex-mono\/latin-500\.css/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /step-end/);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|radial-gradient/);
});

test("keeps only the approved analytics contract", () => {
  assert.match(main, /page_viewed/);
  assert.match(main, /outbound_link_clicked/);
  assert.doesNotMatch(main, /theme_toggled|logo_animation_started/);
  assert.doesNotMatch(analytics, /theme_toggled|logo_animation_started/);
  assert.match(analytics, /"backer"\s*\|\s*"experience"/);
  assert.match(analytics, /is_primary:\s*false/);
  assert.match(agents, /does not define an Initial Value Moment/i);
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `pnpm test`

Expected: FAIL because the current page still has the logo and theme controls and does not have the terminal CSS or reduced analytics contract.

- [ ] **Step 4: Commit the failing contract**

```bash
git add package.json tests/homepage.test.mjs
git commit -m "test: define terminal homepage contract"
```

### Task 2: Build the Semantic Command Transcript

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the current body with the static terminal structure**

Keep the existing `<head>` metadata, but change the browser theme metadata to `<meta name="theme-color" content="#FAFAFA" />`. Replace the visible body with this exact structure:

```html
<body>
  <main class="page-shell">
    <section class="terminal" aria-labelledby="terminalTitle">
      <header class="terminal-header">
        <h1 id="terminalTitle">PRECURSOR_LABS</h1>
        <span>SESSION 01</span>
      </header>
      <div class="terminal-body" tabindex="0" aria-label="Precursor Labs command transcript">
        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor about</span></p>
          <p class="output">Precursor Labs is a research company studying the organizing principles and infrastructure for collective intelligence.</p>
        </section>

        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor thesis</span></p>
          <p class="output">We believe the next generation of autonomous systems will need to coordinate with humans and agents, reason in dynamic environments, and allocate resources under uncertainty.</p>
        </section>

        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor research</span></p>
          <p class="output">We are engineers, financiers, and company builders focusing on multi-agent systems in dynamic social environments, as well as resource scheduling and memory management for latency-constrained inference serving.</p>
        </section>

        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor interests</span></p>
          <p class="output">We are especially interested in partners working on interactive learning, multi-agent RL, KV cache allocation, and scheduling.</p>
        </section>

        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor backers</span></p>
          <ul class="output terminal-list">
            <li><a href="https://www.blockchaincapital.com/" rel="noreferrer" target="_blank" data-track-link-name="blockchain_capital" data-track-link-category="backer">Blockchain Capital</a></li>
            <li><a href="https://reforge.vc/" rel="noreferrer" target="_blank" data-track-link-name="reforge" data-track-link-category="backer">Reforge</a></li>
            <li><a href="https://www.blockchainbuilders.fund/" rel="noreferrer" target="_blank" data-track-link-name="blockchain_builders_fund" data-track-link-category="backer">Blockchain Builders Fund</a></li>
            <li class="terminal-note">and others</li>
          </ul>
        </section>

        <section class="transcript-entry">
          <p class="command"><span class="prompt" aria-hidden="true">$</span><span>precursor experience</span></p>
          <ul class="output terminal-list">
            <li><a href="https://aws.amazon.com/" rel="noreferrer" target="_blank" data-track-link-name="aws" data-track-link-category="experience">AWS</a></li>
            <li><a href="https://www.stanford.edu/" rel="noreferrer" target="_blank" data-track-link-name="stanford" data-track-link-category="experience">Stanford</a></li>
            <li><a href="https://www.northropgrumman.com/" rel="noreferrer" target="_blank" data-track-link-name="northrop_grumman_rl" data-track-link-category="experience">Northrop Grumman RL</a></li>
            <li><a href="https://duke.edu/" rel="noreferrer" target="_blank" data-track-link-name="duke" data-track-link-category="experience">Duke</a></li>
            <li><a href="https://www.centerviewpartners.com/" rel="noreferrer" target="_blank" data-track-link-name="centerview_partners" data-track-link-category="experience">Centerview Partners</a></li>
            <li><a href="https://www.berkeley.edu/" rel="noreferrer" target="_blank" data-track-link-name="berkeley" data-track-link-category="experience">Berkeley</a></li>
            <li><a href="https://www.cornell.edu/" rel="noreferrer" target="_blank" data-track-link-name="cornell" data-track-link-category="experience">Cornell</a></li>
            <li><a href="https://www.harvard.edu/" rel="noreferrer" target="_blank" data-track-link-name="harvard" data-track-link-category="experience">Harvard</a></li>
          </ul>
        </section>

        <p class="final-prompt" aria-hidden="true"><span class="prompt">$</span><span class="cursor"></span></p>
      </div>
    </section>
  </main>
  <script type="module" src="/src/main.ts"></script>
</body>
```

- [ ] **Step 2: Run the focused content tests**

Run: `pnpm test -- --test-name-pattern="renders|destinations"`

Expected: The transcript and destination tests pass. The visual-system and analytics tests still fail.

- [ ] **Step 3: Commit the transcript**

```bash
git add index.html
git commit -m "feat: add semantic terminal transcript"
```

### Task 3: Add the Light Terminal Visual System

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/styles.css`

- [ ] **Step 1: Install the bundled IBM Plex Mono font**

Run: `pnpm add @fontsource/ibm-plex-mono`

Expected: `package.json` and `pnpm-lock.yaml` include the font package.

- [ ] **Step 2: Replace the stylesheet**

Replace the old theme and logo styles with this stylesheet:

```css
@import "@fontsource/ibm-plex-mono/latin-400.css";
@import "@fontsource/ibm-plex-mono/latin-500.css";

:root {
  color-scheme: light;
  --paper: #FAFAFA;
  --ink: #171717;
  --muted: #71716B;
  --accent: #659F58;
  --line: #E5E5E3;
  --hover: rgb(0 0 0 / 4%);
  background: var(--paper);
  color: var(--ink);
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-width: 320px;
  min-height: 100%;
  margin: 0;
  background: var(--paper);
}

body {
  overflow: hidden;
}

.page-shell {
  display: grid;
  min-height: 100svh;
  padding: 20px;
  place-items: center;
}

.terminal {
  display: grid;
  width: min(900px, calc(100vw - 40px));
  height: clamp(520px, 72svh, 720px);
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid var(--line);
  background: var(--paper);
}

.terminal-header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  line-height: 1;
}

.terminal-header h1 {
  margin: 0;
  font: inherit;
  font-weight: 500;
}

.terminal-body {
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.65;
  scrollbar-color: var(--line) var(--paper);
  scrollbar-width: thin;
}

.terminal-body::-webkit-scrollbar {
  width: 8px;
}

.terminal-body::-webkit-scrollbar-track {
  background: var(--paper);
}

.terminal-body::-webkit-scrollbar-thumb {
  border: 2px solid var(--paper);
  background: var(--line);
}

.terminal-body::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

.terminal-body:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.transcript-entry + .transcript-entry,
.final-prompt {
  margin-top: 24px;
}

.command,
.output,
.final-prompt {
  margin-bottom: 0;
}

.command,
.final-prompt {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 0;
  font-weight: 500;
}

.output {
  margin-top: 8px;
}

.prompt,
.terminal-note {
  color: var(--muted);
}

.terminal-list {
  padding: 0;
  list-style: none;
}

.terminal-list li {
  min-height: 28px;
}

.terminal-list li::before {
  content: "- ";
  color: var(--muted);
}

a {
  color: inherit;
  text-decoration-color: var(--muted);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: background-color 120ms ease;
}

a:hover {
  background: var(--hover);
}

a:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
  background: var(--hover);
}

.cursor {
  display: inline-block;
  width: 0.65em;
  height: 1.1em;
  background: var(--accent);
  animation: cursor-blink 1s step-end infinite;
  vertical-align: -0.15em;
}

@keyframes cursor-blink {
  0%,
  49% {
    visibility: visible;
  }

  50%,
  100% {
    visibility: hidden;
  }
}

@media (max-width: 600px), (max-height: 560px) {
  .page-shell {
    padding: 12px;
  }

  .terminal {
    width: calc(100vw - 24px);
    height: calc(100svh - 24px);
  }

  .terminal-body {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor {
    animation: none;
  }
}
```

- [ ] **Step 3: Run the visual-system test**

Run: `pnpm test -- --test-name-pattern="visual system"`

Expected: PASS.

- [ ] **Step 4: Commit the visual system**

```bash
git add package.json pnpm-lock.yaml src/styles.css
git commit -m "feat: style light terminal homepage"
```

### Task 4: Reduce and Synchronize Analytics

**Files:**
- Modify: `src/main.ts`
- Modify: `src/analytics.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Reduce the page runtime**

Replace `src/main.ts` with:

```ts
import "./styles.css";
import { trackMixpanelEvent } from "./analytics.ts";

trackMixpanelEvent("page_viewed", {
  page_path: window.location.pathname,
  platform: "web",
});

document.querySelectorAll<HTMLAnchorElement>("[data-track-link-name]").forEach((link) => {
  link.addEventListener("click", () => {
    const linkName = link.dataset.trackLinkName;
    const linkCategory = link.dataset.trackLinkCategory;

    if (!linkName || (linkCategory !== "backer" && linkCategory !== "experience")) {
      return;
    }

    trackMixpanelEvent("outbound_link_clicked", {
      link_name: linkName,
      link_category: linkCategory,
      is_primary: false,
    });
  });
});
```

- [ ] **Step 2: Narrow the analytics type**

Replace the event map at the top of `src/analytics.ts` with the following and keep the existing production-only, lazy, non-blocking Mixpanel initialization and generic tracking function unchanged:

```ts
type MixpanelEventProperties = {
  page_viewed: {
    page_path: string;
    platform: "web";
  };
  outbound_link_clicked: {
    link_name: string;
    link_category: "backer" | "experience";
    is_primary: false;
  };
};
```

- [ ] **Step 3: Synchronize the tracking plan**

Replace the current event table, Initial Value Moment sentence, and stable values with:

```markdown
| Mixpanel Event | Trigger | Key Properties | File |
|---|---|---|---|
| `page_viewed` | The production website loads | `page_path`, `platform` | `src/main.ts` |
| `outbound_link_clicked` | A tracked backer or experience link is opened | `link_name`, `link_category`, `is_primary` | `src/main.ts`, `index.html` |

The redesigned homepage does not define an Initial Value Moment. The previous Initial Value Moment was the removed primary Substack link. Do not select a replacement without a separate product decision.

### Stable property values

- `platform`: `web`
- `link_category`: `backer` or `experience`
- `is_primary`: always `false` on the redesigned homepage
```

Remove the `theme_toggled` and `logo_animation_started` rows and remove the old `social`, `trigger`, and `theme` stable values. Keep the general Mixpanel implementation rules intact.

- [ ] **Step 4: Run the analytics contract test**

Run: `pnpm test -- --test-name-pattern="analytics contract"`

Expected: PASS.

- [ ] **Step 5: Commit the analytics reduction**

```bash
git add src/main.ts src/analytics.ts AGENTS.md
git commit -m "refactor: remove retired homepage analytics"
```

### Task 5: Run Automated Verification

**Files:**
- Modify only if a verification failure exposes a defect in the planned files.

- [ ] **Step 1: Run the full source contract**

Run: `pnpm test`

Expected: 4 tests pass and 0 fail.

- [ ] **Step 2: Run the TypeScript check**

Run: `pnpm check`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Build the production site**

Run: `pnpm build`

Expected: exit code 0 and a Vite production bundle in `dist/`.

- [ ] **Step 4: Inspect the production bundle contract**

Run:

```bash
set -euo pipefail
rg -Fq "Precursor Labs is a research company" dist/index.html
rg -Fq "precursor experience" dist/index.html
rg -Fq "SESSION 01" dist/index.html
rg -iq "IBM Plex Mono" dist/assets/*.css
rg -iq "@font-face" dist/assets/*.css
rg -iq "#659f58" dist/assets/*.css
rg -n "\\.woff2" dist/assets/*.css
find dist/assets -type f -name '*.woff2' -print -quit | rg -q .
! rg -ni "fonts\\.googleapis\\.com|fonts\\.gstatic\\.com|theme_toggled|logo_animation_started" dist
```

Expected: every command exits 0. The WOFF2 reference search prints bundled font references, the file search confirms at least one WOFF2 asset exists, and the last command has no output because removed events and third-party font hosts are absent.

### Task 6: Verify the Rendered Page

**Files:**
- Modify only if browser verification exposes a defect.

- [ ] **Step 1: Start or reuse the local Vite development server**

Run: `pnpm dev`

Expected: the site is available on a local Vite URL.

- [ ] **Step 2: Verify desktop layout**

At 1440 x 900, confirm the terminal is centered, uses a 900px maximum width, has a fixed responsive height, starts at the first command, and scrolls internally to the final green cursor.

- [ ] **Step 3: Verify responsive layouts**

At 390 x 844, 390 x 600, and 1024 x 540, confirm 12px clearance applies when required, there is no horizontal page scroll, and the terminal body remains the vertical scroll container.

Set browser zoom to 200% at the 1440 x 900 desktop window. Confirm the effective narrow-or-short layout has no horizontal page scroll and all content remains readable. Reset browser zoom to 100% after the check.

- [ ] **Step 4: Verify interaction and accessibility states**

Confirm every credibility link is keyboard reachable with a visible focus style, hover transitions are no more than 150ms, the cursor is the only automatic motion, and reduced motion stops its blink.

- [ ] **Step 5: Verify the production page without JavaScript execution**

Start the built site with `pnpm preview`, then run:

```bash
set -euo pipefail
PREVIEW_HTML=$(curl --fail --silent --show-error http://127.0.0.1:4173/)
for marker in \
  "Precursor Labs is a research company" \
  "precursor experience" \
  "stylesheet" \
  "https://www.blockchaincapital.com/" \
  "https://reforge.vc/" \
  "https://www.blockchainbuilders.fund/" \
  "https://aws.amazon.com/" \
  "https://www.stanford.edu/" \
  "https://www.northropgrumman.com/" \
  "https://duke.edu/" \
  "https://www.centerviewpartners.com/" \
  "https://www.berkeley.edu/" \
  "https://www.cornell.edu/" \
  "https://www.harvard.edu/"
do
  printf '%s' "$PREVIEW_HTML" | rg -Fq "$marker"
done
```

Expected: the loop exits 0 because every required content, stylesheet, and destination marker is present in the production HTML returned to a client that does not execute JavaScript.

- [ ] **Step 6: Verify failure isolation**

Block the IBM Plex Mono font request during browser inspection and confirm the declared monospace fallback keeps the content readable without overflow. Confirm local development sends no Mixpanel request.

### Task 7: Resolve Any Verification Defect

**Files:**
- Modify only the planned implementation and test files that cause a failed verification check.

- [ ] **Step 1: Apply the smallest defect fix if any check fails**

For each failed automated or browser check, first add or tighten the related assertion in `tests/homepage.test.mjs` when the failure can be automated. Confirm the assertion fails, then make one scoped implementation change.

- [ ] **Step 2: Repeat affected and full verification**

Re-run the check that exposed the defect, then run:

```bash
pnpm test
pnpm check
pnpm build
```

Expected: the original failing check passes, 4 tests pass, TypeScript reports no errors, and the production build exits 0. Repeat the relevant browser viewport, zoom, reduced-motion, no-JavaScript, font-fallback, or analytics check when that area changed.

- [ ] **Step 3: Commit verified fixes when needed**

If Task 7 changed files, stage only those files and commit them with `git commit -m "fix: correct terminal homepage verification"`.

- [ ] **Step 4: Check repository state**

Run: `git status --short`

Expected: no uncommitted implementation changes. The local `dist/` output remains ignored.
