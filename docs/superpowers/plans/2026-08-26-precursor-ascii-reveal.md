# PRECURSOR ASCII Reveal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every fourth existing ASCII scramble resolve to `PRECURSOR` for 1.5 seconds in semi-opaque accent green.

**Architecture:** Add a small reveal controller for deterministic launch selection, lifecycle timing, and cancellation. It accepts the existing cancellable timeout function, so unit tests can use a fake scheduler and reduced motion can stop pending work. Brand segments use the current scramble path, then the controller gives the word a complete 1.5-second hold before the current cleanup path restores random glyphs.

**Tech Stack:** Vite 5, TypeScript, Node test runner, vanilla DOM and CSS

---

## Chunk 1: Brand reveal behavior

### Task 1: Add testable selection and timing rules

**Files:**
- Create: `src/ascii-reveal.ts`
- Create: `tests/ascii-reveal.test.mjs`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Write the failing unit tests**

Test that launch counts 4, 8, and 12 are brand launches, while adjacent counts are not. Use a fake scheduler to test the real reveal controller: scrambling is allowed before 3,500 ms; the reveal callback displays `PRECURSOR` at 3,500 ms and stops scrambling; the completion callback does not run for another 1,500 ms; cancellation prevents both callbacks. Update the homepage source test to require `PRECURSOR` and the `28%` brand class.

```js
assert.equal(isBrandLaunch(4), true);
assert.equal(isBrandLaunch(5), false);
const controller = startBrandRevealTimeline(fakeSchedule, onReveal, onComplete);
fakeClock.advanceBy(3499);
assert.equal(controller.shouldScramble(), true);
fakeClock.advanceBy(1);
assert.equal(revealedText, "PRECURSOR");
assert.equal(controller.shouldScramble(), false);
fakeClock.advanceBy(1499);
assert.equal(completed, false);
fakeClock.advanceBy(1);
assert.equal(completed, true);
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `pnpm test`

Expected: FAIL because `src/ascii-reveal.ts` and the brand style do not exist.

- [ ] **Step 3: Add the pure helper**

Create constants for `PRECURSOR`, every-fourth selection, 3,500 ms scramble time, and 1,500 ms reveal time. Export `isBrandLaunch(successfulLaunchCount)` and `startBrandRevealTimeline(schedule, onReveal, onComplete)`. The controller exposes `shouldScramble()` and `cancel()`.

```ts
export const BRAND_REVEAL_TEXT = "PRECURSOR";
export const BRAND_REVEAL_HOLD_MS = 1500;
export const BRAND_SCRAMBLE_MS = 3500;

export function isBrandLaunch(count: number): boolean {
  return count > 0 && count % 4 === 0;
}
```

- [ ] **Step 4: Run the focused unit test**

Run: `node --test tests/ascii-reveal.test.mjs`

Expected: PASS.

### Task 2: Connect the tested reveal controller to the current scramble system

**Files:**
- Modify: `src/animated-background.ts`
- Modify: `src/styles.css`
- Test: `tests/ascii-reveal.test.mjs`
- Test: `tests/homepage.test.mjs`

- [ ] **Step 1: Extend the failing source contract**

Require `animated-background.ts` to import and call `startBrandRevealTimeline`, require the brand-visible state to control the brand class, and require `queueTimeout` to return a cancellation function. Run `pnpm test` and confirm that this new runtime contract fails before editing production code.

- [ ] **Step 2: Add brand state to existing segments**

Track successful launches. Mark every fourth launch with `isBrandLaunch`. Use `PRECURSOR.length` for brand segment width and keep the current random width for other segments. Add an `isBrandVisible` field so rendering does not infer state from the displayed text.

- [ ] **Step 3: Reuse the scramble and add the tested hold controller**

Brand segments scramble with the current 90–150 ms ticks while `controller.shouldScramble()` is true. The controller's reveal callback sets the text to `PRECURSOR`, sets `isBrandVisible`, and renders. Its completion callback writes the segment's random final text into the row and removes the active segment. Pass the existing timeout registry through the controller so `stopAnimation()` cancels pending reveals and holds when visibility or reduced-motion state changes.

- [ ] **Step 4: Add the brand style**

Keep `.ascii-background-segment` at `14%`. Add `.ascii-background-brand` with `color: rgb(101 159 88 / 28%)`.

- [ ] **Step 5: Run the complete automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, the TypeScript check passes, and the Vite production build completes.

- [ ] **Step 6: Check the live behavior**

Run `pnpm dev` if the local server is not already active, then open `http://127.0.0.1:5173/`. Confirm that the fourth launched segment resolves to `PRECURSOR`, its computed color is `rgba(101, 159, 88, 0.28)`, it stays visible for at least 1.5 seconds, and it returns to random glyphs. Confirm that the terminal remains solid `rgb(250, 250, 250)`.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/ascii-reveal.ts src/animated-background.ts src/styles.css tests/ascii-reveal.test.mjs tests/homepage.test.mjs
git commit -m "feat: surface precursor in ascii animation"
```
