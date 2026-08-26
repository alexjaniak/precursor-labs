# Terminal Elastic Card Stack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the current terminal and three placeholder terminals into a responsive four-card GSAP spread stack.

**Architecture:** Keep state, timing, and geometry in one pure TypeScript module. Keep DOM events, GSAP work, focus, and cleanup in one controller. Keep stack layout CSS separate from the existing terminal visual CSS. Use the same four semantic cards in all layout modes.

**Tech Stack:** Vite 5, TypeScript, GSAP, IBM Plex Mono, semantic HTML, Node test runner through `tsx`.

**Design specification:** `docs/superpowers/specs/2026-08-26-terminal-elastic-card-stack-design.md`

---

## Chunk 1: State, Geometry, and Source Contract

### Task 1: Add GSAP and preserve the purchased license

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `licenses/elastic-stack-cards-LICENSE.txt`
- Create: `tests/vendor-license.test.mjs`

- [ ] **Step 1: Add the dependency**

Run:

```bash
pnpm add gsap
```

Expected: `gsap` is in `dependencies` and the lock file changes.

- [ ] **Step 2: Copy the source license into the repository**

Extract `elastic-stack-cards/LICENSE.txt` from `/Users/dylanvu/Downloads/elastic-stack-cards.zip`. Save the exact text as `licenses/elastic-stack-cards-LICENSE.txt`. Do not copy unused demo files.

- [ ] **Step 3: Add the license-preservation test**

Create `tests/vendor-license.test.mjs`. It must require the committed license and check these source markers:

```js
assert.match(license, /^GSAP VAULT STANDARD LICENSE/m);
assert.match(license, /Elastic Stack Cards \(effect, elastic-stack-cards\)/);
assert.match(license, /Copyright \(c\) 2026 GSAP Vault\. All rights reserved\./);
assert.match(license, /https:\/\/gsapvault\.com\/terms/);
```

- [ ] **Step 4: Check the dependency and license**

Run:

```bash
rg -n '"gsap"' package.json pnpm-lock.yaml
cmp licenses/elastic-stack-cards-LICENSE.txt <(unzip -p /Users/dylanvu/Downloads/elastic-stack-cards.zip elastic-stack-cards/LICENSE.txt)
pnpm exec tsx --test tests/vendor-license.test.mjs
```

Expected: GSAP is present, `cmp` has no output, and the license test passes.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml licenses/elastic-stack-cards-LICENSE.txt tests/vendor-license.test.mjs
git commit -m "build: add licensed elastic stack dependency"
```

### Task 2: Build and test the pure stack model

**Files:**

- Create: `src/terminal-stack-model.ts`
- Create: `tests/terminal-stack-model.test.mjs`

- [ ] **Step 1: Write failing state and timing tests**

Test these exports:

```ts
export const CARD_IDS = ["session-01", "session-02", "session-03", "session-04"] as const;
export const MOTION = {
  open: { duration: 0.8, ease: "elastic.out(0.7, 0.5)" },
  close: { duration: 0.6, ease: "elastic.out(0.6, 0.4)" },
  select: { duration: 0.45, ease: "elastic.out(0.7, 0.5)" },
  release: { duration: 0.4, ease: "power2.out" },
} as const;
```

Cover:

- Initial state is closed, unlocked, unselected, and `spread`.
- Preview open and close work only while unlocked.
- Lock keeps the stack open.
- Stable card selection persists after preview close.
- Selecting the active card returns the same state object.
- Overview clears open, lock, and selection state, but preserves `layoutMode`.
- A mode change preserves selection and lock, but closes an unlocked preview.
- Spread delay is `Math.abs(u) * 0.09`.
- Rest delay is `Math.abs(i - mid) * 0.02`.

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/terminal-stack-model.test.mjs
```

Expected: FAIL because `src/terminal-stack-model.ts` does not exist.

- [ ] **Step 3: Add the failing geometry tests**

Cover:

- The four resting transforms use the purchased values.
- `session-01` has the largest resting `zIndex`, including after Overview.
- Wide input returns `spread` and uses the exact measured source geometry below.
- Medium input returns `compressed`, uses the exact safe-half calculation below, and stays inside the container after rotation and selected-card scaling.
- Adjacent compressed centers have at least `44px` of exposed title bar.
- An outer selected card uses `y - 26` and `scale + 0.05`, and its rotated bound stays inside the container.
- Narrow or short input returns `vertical`.
- The same input always returns the same transforms.

Run:

```bash
pnpm exec tsx --test tests/terminal-stack-model.test.mjs
```

Expected: geometry tests fail because the functions do not exist.

- [ ] **Step 4: Implement the state reducer and geometry**

Use these types and public functions:

```ts
export type CardId = (typeof CARD_IDS)[number];
export type LayoutMode = "spread" | "compressed" | "vertical";

export type StackState = {
  isOpen: boolean;
  isLocked: boolean;
  activeCardId: CardId | null;
  layoutMode: LayoutMode;
};

export type StackAction =
  | { type: "preview-open" }
  | { type: "preview-close" }
  | { type: "lock-open" }
  | { type: "select"; cardId: CardId }
  | { type: "overview" }
  | { type: "layout"; layoutMode: LayoutMode };

export type CardTransform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
  zIndex: number;
};

export function createInitialState(): StackState;
export function reduceStackState(state: StackState, action: StackAction): StackState;
export function getRestTransforms(cardCount: number): CardTransform[];
export function getSpreadTransforms(input: {
  containerWidth: number;
  cardWidth: number;
  cardHeight: number;
  cardCount: number;
  compressed: boolean;
}): CardTransform[];
export function getLayoutMode(input: {
  containerWidth: number;
  viewportHeight: number;
  cardWidth: number;
  cardHeight: number;
  cardCount: number;
}): LayoutMode;
```

Copy the purchased resting transform values exactly. Reverse only the layer value so `session-01` is frontmost:

```ts
x: (i - mid) * 3
y: (cardCount - 1 - i) * 2
rotation: (i - mid) * 1.5
scale: 1 - (cardCount - 1 - i) * 0.015
delay: Math.abs(i - mid) * 0.02
zIndex: cardCount - i
```

Use this deterministic fit calculation. It starts with the purchased measured-container formula. `12px` is the page gutter, `9deg` is the purchased maximum spread rotation, and `0.05` is the purchased selected-card scale increase:

```ts
const MIN_EXPOSURE = 44;
const OUTER_GUTTER = 12;
const MAX_ROTATION_DEGREES = 9;
const SELECTED_SCALE_INCREASE = 0.05;
const radians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
const sourceTravel = Math.max(0, (containerWidth - cardWidth) / 2);
const sourceHalf =
  sourceTravel - Math.min(cardHeight * 0.14, sourceTravel * 0.45);
const selectedRotatedHalfWidth =
  (1 + SELECTED_SCALE_INCREASE) *
  (cardWidth * Math.abs(Math.cos(radians)) +
    cardHeight * Math.abs(Math.sin(radians))) /
  2;
const safeHalf = Math.max(
  0,
  containerWidth / 2 - OUTER_GUTTER - selectedRotatedHalfWidth,
);
const requiredHalf = (MIN_EXPOSURE * (cardCount - 1)) / 2;
```

The mode rule is exact:

```ts
if (viewportHeight < cardHeight + 120 || safeHalf < requiredHalf) return "vertical";
if (safeHalf >= sourceHalf) return "spread";
return "compressed";
```

Use `half = sourceHalf` in spread mode and `half = safeHalf` in compressed mode. Then use the purchased shape:

```ts
x: u * half
y: -Math.abs(u) * 5 * (cardCount - 1)
rotation: u * 9
scale: 1
delay: Math.abs(u) * 0.09
```

Selection uses the purchased geometry relative to the active open or resting transform:

```ts
y: base.y - 26
scale: base.scale + 0.05
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm exec tsx --test tests/terminal-stack-model.test.mjs
```

Expected: all model tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/terminal-stack-model.ts tests/terminal-stack-model.test.mjs
git commit -m "feat: add terminal stack state and geometry"
```

## Chunk 2: Semantic Cards and Layout

### Task 3: Add the four terminal cards and stack controls

**Files:**

- Modify: `index.html`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Write failing HTML contract tests**

Add one focused test that requires:

- One `[data-terminal-stack]` region.
- Four `<article class="terminal terminal-card">` elements.
- Stable `data-card-id` values `session-01` through `session-04`.
- Four title-bar `<button>` elements with matching `data-card-select` values.
- Session labels `SESSION 01` through `SESSION 04`.
- The first title is `PRECURSOR_LABS — zsh`.
- Placeholder titles are `PLACEHOLDER — zsh`.
- Each placeholder body contains `$ content_pending`.
- A separate `Explore` button with `aria-expanded="false"`.
- A hidden navigation with `Overview / 01 / 02 / 03 / 04` buttons.
- Card bodies are not buttons and contain no stack action data attribute.
- The existing transcript copy and links are unchanged.

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/homepage.test.mjs
```

Expected: the new four-card contract test fails.

- [ ] **Step 3: Replace the single terminal wrapper with semantic stack markup**

Use this structure:

```html
<section class="terminal-stack-region" data-terminal-stack aria-label="Terminal sessions">
  <h1 class="visually-hidden">Precursor Labs</h1>
  <div class="terminal-stack-stage" data-stack-stage>
    <article class="terminal terminal-card" data-card-id="session-01">
      <button class="terminal-header terminal-card-trigger" type="button" data-card-select="session-01">
        <!-- existing dots, title, and SESSION 01 -->
      </button>
      <div class="terminal-body" role="region" tabindex="0" aria-label="Precursor Labs command transcript">
        <!-- current transcript without copy or link changes -->
      </div>
    </article>
    <!-- Three matching placeholder articles -->
  </div>
  <div class="terminal-stack-controls">
    <button class="terminal-stack-explore" type="button" data-stack-explore aria-expanded="false">
      Explore
    </button>
    <nav class="terminal-stack-nav" data-stack-nav aria-label="Terminal session navigation" hidden>
      <button type="button" data-stack-overview>Overview</button>
      <button type="button" data-card-select="session-01">01</button>
      <button type="button" data-card-select="session-02">02</button>
      <button type="button" data-card-select="session-03">03</button>
      <button type="button" data-card-select="session-04">04</button>
    </nav>
  </div>
</section>
```

The title-bar button can contain only phrasing content. Use `<span class="terminal-title">` instead of a heading inside the button. Keep the real page `<h1>` outside the button.

- [ ] **Step 4: Run the HTML contract tests**

Run:

```bash
pnpm exec tsx --test tests/homepage.test.mjs
```

Expected: all home-page source tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage.test.mjs
git commit -m "feat: add terminal stack markup"
```

### Task 4: Add the no-shadow stack layout and responsive list

**Files:**

- Create: `src/terminal-stack.css`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Write failing style contract tests**

Require:

- `src/main.ts` imports `terminal-stack.css` after `styles.css`.
- The stage and cards use `transform-origin: center bottom` and `will-change: transform`.
- Cards have a solid `var(--paper)` background, 1px border, 8px corners, and no shadow.
- The compact pile has a readable `session-01` front card before JavaScript runs.
- Explore and all navigation buttons are at least `44px` high.
- Focus-visible uses the accent color.
- The vertical mode allows page scroll and prevents horizontal page overflow.
- Reduced motion shows all four cards in a normal vertical list with no transforms.
- No `box-shadow`, gradient, ScrollTrigger, or Lenis is added.

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/homepage.test.mjs
```

Expected: the new stack style test fails because the CSS file is missing.

- [ ] **Step 3: Add stack CSS**

Keep these responsibilities in `src/terminal-stack.css`:

- Stage positioning and card overlap.
- No-JavaScript resting pile order.
- Explore and expanded pill navigation.
- Active, selected, and focus states.
- `data-layout-mode="vertical"` accordion-like layout.
- `prefers-reduced-motion: reduce` static four-card list.

Keep terminal surface, typography, body scroll, and window-dot styles in `src/styles.css`. Change `.terminal-header` so it is a reset button with the current visual values. Change the body overflow rule only when the stack is vertical or reduced motion.

Use CSS state attributes that the controller owns:

```css
[data-terminal-stack][data-layout-mode="vertical"] { /* list layout */ }
[data-terminal-stack][data-stack-open="true"] { /* open controls */ }
[data-terminal-stack][data-active-card="session-02"] { /* selected state */ }
```

- [ ] **Step 4: Import stack CSS after base styles**

At the top of `src/main.ts`:

```ts
import "./styles.css";
import "./terminal-stack.css";
```

- [ ] **Step 5: Run the tests and build**

Run:

```bash
pnpm test
pnpm run build
```

Expected: tests and TypeScript build pass.

- [ ] **Step 6: Commit**

```bash
git add src/terminal-stack.css src/styles.css src/main.ts tests/homepage.test.mjs
git commit -m "style: add responsive terminal stack layout"
```

## Chunk 3: Controller, Cleanup, and Verification

### Task 5: Add the GSAP stack controller with strict body isolation

**Files:**

- Create: `src/terminal-stack.ts`
- Create: `tests/terminal-stack-controller.test.mjs`
- Modify: `src/main.ts`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Write failing cleanup tests**

Export and test this helper so cleanup work has one audited path:

```ts
export type StackCleanupResources = {
  removeListeners: () => void;
  disconnectObserver: () => void;
  cancelPendingResize: () => void;
  removeMotionListener: () => void;
  revertGsapContext: () => void;
  killActiveTweens: () => void;
};

export function cleanupStackResources(resources: StackCleanupResources): void;
```

Use six spies. Call `cleanupStackResources` twice. Confirm that each resource is released exactly once. This makes cleanup idempotent.

Add source checks that the controller:

- Uses `ResizeObserver`.
- Uses `matchMedia("(prefers-reduced-motion: reduce)")`.
- Calls `cleanupStackResources` from its returned cleanup function.
- Never adds an event listener to `.terminal-body` or `.terminal-card`.
- Never calls `preventDefault()`.

The test must also start the real `startTerminalStack` function with injected test dependencies and structural fake elements. The injection can supply a fake element query, GSAP API, `ResizeObserver`, media query, animation-frame request, and animation-frame cancel. Prove these effects:

- A button click changes state before cleanup but not after cleanup because listeners are removed.
- A fake observer can schedule resize work before cleanup, but it is disconnected after cleanup.
- Pending fake animation-frame work is canceled.
- A media-query change works before cleanup but not after its listener is removed.
- The GSAP context is reverted through the fake API.
- Active card tweens are killed through the fake API.
- A second cleanup call changes no counters.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/terminal-stack-controller.test.mjs tests/homepage.test.mjs
```

Expected: FAIL because `src/terminal-stack.ts` does not exist.

- [ ] **Step 3: Implement the controller**

Use this public entry point. Production uses the defaults. Tests can inject structural fakes without a browser DOM:

```ts
export type TerminalStackDependencies = {
  elements?: TerminalStackElements;
  gsapApi?: TerminalStackGsap;
  ResizeObserverCtor?: typeof ResizeObserver;
  motionQuery?: MediaQueryList;
  requestFrame?: typeof requestAnimationFrame;
  cancelFrame?: typeof cancelAnimationFrame;
};

export function startTerminalStack(
  root: HTMLElement,
  dependencies?: TerminalStackDependencies,
): () => void;
```

The controller must:

1. Query the four articles, title-bar buttons, Explore, Overview, stage, and number buttons once.
2. Validate that all stable IDs exist. Return a no-op cleanup if markup is incomplete.
3. Create one GSAP context scoped to `root`.
4. Measure the stage and first card, then use `getLayoutMode`, `getRestTransforms`, and `getSpreadTransforms`.
5. Set the initial transforms without motion.
6. Animate open, close, selection, and release with the exact `MOTION` values.
7. Keep the selected card above the other cards after an unlocked preview closes.
8. Set `data-stack-open`, `data-layout-mode`, and `data-active-card` on `root` after every state change.
9. Keep `aria-expanded` on Explore correct.
10. Keep the expanded navigation in the HTML `hidden` state until the stack is locked.
11. Set `aria-pressed="true"` on the active number button and `aria-pressed="false"` on every inactive number button.
12. When Enter, Space, or click locks Explore, show the expanded navigation and move focus to `Overview`.
13. On Overview, reset open, lock, and selection state, preserve the measured layout mode, and focus Explore.
14. Use only the stack region for `pointerenter`, `pointerleave`, `focusin`, and `focusout` preview boundaries.
15. Use click listeners only on Explore, Overview, title bars, and number buttons.
16. Do not add any handler to a card body or whole article.
17. Debounce resize work with one animation frame and cancel it during cleanup.
18. On a layout-mode change, keep lock and selection, close an unlocked preview, and set destination geometry immediately.
19. In reduced motion, set the reduced-motion attribute, clear transforms, do not attach fan listeners, and keep all cards readable.

Use a local listener registry:

```ts
const listenerCleanups: Array<() => void> = [];

const listen = <K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
) => {
  target.addEventListener(type, handler as EventListener);
  listenerCleanups.push(() => target.removeEventListener(type, handler as EventListener));
};
```

Do not add analytics for stack use.

- [ ] **Step 4: Start and stop the controller from the page entry point**

Add:

```ts
const terminalStack = document.querySelector<HTMLElement>("[data-terminal-stack]");

if (terminalStack) {
  const stopTerminalStack = startTerminalStack(terminalStack);
  window.addEventListener("pagehide", stopTerminalStack, { once: true });
}
```

- [ ] **Step 5: Run focused and full checks**

Run:

```bash
pnpm exec tsx --test tests/terminal-stack-controller.test.mjs tests/homepage.test.mjs
pnpm test
pnpm run build
git diff --check
```

Expected: all commands pass with no output from `git diff --check`.

- [ ] **Step 6: Commit**

```bash
git add src/terminal-stack.ts src/main.ts tests/terminal-stack-controller.test.mjs tests/homepage.test.mjs
git commit -m "feat: animate the terminal card stack"
```

### Task 6: Verify the built page in the browser

**Files:**

- Modify only if a verified defect needs a focused fix.

- [ ] **Step 1: Start the local page**

Run:

```bash
pnpm dev
```

Expected: Vite reports a local `127.0.0.1` URL.

- [ ] **Step 2: Check the wide layout**

Confirm:

- The initial pile is compact and session 01 is frontmost.
- The page has no horizontal or vertical page scroll in the wide mode.
- Explore hover and focus preview the spread.
- Moving pointer or focus between Explore and the stack does not close the preview.
- Clicking Explore locks the cards and shows `Overview / 01 / 02 / 03 / 04`.
- Each title bar and number pill selects the correct stable card.
- Selecting the active card does nothing.
- The selected card stays frontmost after a non-locked preview closes.
- Overview restores the original pile and returns focus to Explore.
- There are no shadows.

- [ ] **Step 3: Check card-body isolation**

Confirm:

- Session 01 scrolls inside its solid card.
- Text can be selected.
- Links work and do not move a card.
- Body focus does not select or close a card.

- [ ] **Step 4: Check keyboard-only use**

Confirm without the pointer:

- Tab focus has a visible accent outline.
- Focusing Explore starts the preview.
- Enter and Space on Explore each lock the stack and move focus to Overview.
- Tab reaches every session pill and title bar in a logical order.
- Enter and Space select the correct card.
- Focus movement inside the region does not close an unlocked preview.
- Overview returns focus to Explore.

- [ ] **Step 5: Check medium, narrow, and short viewports**

Confirm:

- Medium width uses a smaller safe spread without reducing card size.
- Narrow or short height uses the vertical title-bar layout.
- Each exposed title bar is at least `44px` high.
- The selected body stays readable.
- Page scrolling is available in vertical mode.
- There is no horizontal page overflow.

- [ ] **Step 6: Check touch input without hover**

Use touch emulation. Confirm:

- One tap on Explore locks the stack.
- A tap on each title bar selects the matching stable card.
- A tap on each number pill selects the matching stable card.
- No action depends on pointer hover.
- All controls have at least a `44px` hit height.

- [ ] **Step 7: Check reduced motion and cleanup**

Confirm:

- Reduced motion shows all four cards in a readable vertical list.
- No fan animation runs.
- Open, select, resize, Overview, and `pagehide` produce no console errors.

- [ ] **Step 8: Run final verification**

Run:

```bash
pnpm test
pnpm run build
git diff --check
git status --short
```

Expected: tests and build pass, the diff check is clean, and only intended files are changed.

## Chunk 4: Cursor Explore Revision

### Task 7: Replace the Explore label and final terminal cursor

**Files:**

- Create: `public/cursor-text-green.svg`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/terminal-stack.css`
- Modify: `src/terminal-stack-model.ts`
- Modify: `tests/homepage.test.mjs`
- Modify: `tests/terminal-stack-model.test.mjs`

- [ ] **Step 1: Write failing source and geometry tests**

Require the copied SVG, an icon-only Explore button with `aria-label="Explore terminal sessions"`, decorative image semantics, the 1-second step blink and reduced-motion override, a 20px control gap, the matching `11/20` model constants, exact 900px fit, and no final prompt or block-cursor CSS.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm exec tsx --test tests/homepage.test.mjs tests/terminal-stack-model.test.mjs`

Expected: FAIL because the page still has Explore text, the final prompt, and the old `11/20` geometry.

- [ ] **Step 3: Make the minimal implementation**

Copy the supplied SVG unchanged into `public/`. Replace the Explore text with a decorative 24px image inside the existing button. Remove the final prompt markup and old block-cursor styles. Add the icon blink in `terminal-stack.css`, set the stack gap to 20px, set nonvertical top padding to 11px, and update the shared geometry constants.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec tsx --test tests/homepage.test.mjs tests/terminal-stack-model.test.mjs
pnpm test
pnpm run build
git diff --check
```

Expected: all tests and the production build pass.

- [ ] **Step 5: Check the local page and commit**

Confirm the new gap, blinking SVG, removed final prompt, stable stack interaction, and no console errors. Commit only the intended files.
