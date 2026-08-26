# PRECURSOR ASCII Reveal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every fourth existing ASCII scramble resolve to `PRECURSOR`, highlight it for 1.5 seconds, and then keep the word in the neutral field.

**Architecture:** Use the existing reveal controller for deterministic launch selection, lifecycle timing, and cancellation. Brand segments use the current scramble path, then the controller gives the word a complete 1.5-second green highlight. Completion stores `PRECURSOR` in the underlying row instead of random final text, so removing the active span changes only the color back to neutral.

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

## Chunk 2: Neutral scrambles and persistent company name

### Task 3: Correct segment color and brand completion

**Files:**
- Modify: `src/ascii-reveal.ts`
- Modify: `src/animated-background.ts`
- Modify: `src/styles.css`
- Test: `tests/ascii-reveal.test.mjs`
- Test: `tests/homepage.test.mjs`

- [ ] **Step 1: Write the failing regression tests**

Change the reveal-controller test so the completion callback receives `PRECURSOR`. Change the homepage contract so normal active segments must use `color: inherit`, the brand class must use `rgb(101 159 88 / 40%)`, and the brand completion callback must pass its completion text into the shared finish function. Also require `finishSegment` to default to `segment.finalText` and require the ordinary completion path to call it without an override.

```js
assert.equal(completedText, "PRECURSOR");
assert.match(css, /\.ascii-background-segment\s*\{[^}]*color:\s*inherit/s);
assert.match(css, /\.ascii-background-brand\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 40%\)/s);
assert.match(background, /replacementText\s*=\s*segment\.finalText/);
assert.match(background, /finishSegment\(segment\);/);
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `pnpm test`

Expected: FAIL because completion has no text argument, normal scrambles are green at `14%`, and the brand highlight is `28%`.

- [ ] **Step 3: Return the saved word from the reveal controller**

Change `onComplete` to accept a string and call it with `BRAND_REVEAL_TEXT` after the 1.5-second hold. Keep all existing cancellation behavior.

```ts
onComplete: (text: string) => void
// after the hold
onComplete(BRAND_REVEAL_TEXT);
```

- [ ] **Step 4: Store the word when the brand segment closes**

Let `finishSegment` accept an optional replacement string that defaults to `segment.finalText`. Pass the completion text from the brand controller into `finishSegment`. This keeps normal completion unchanged and stores `PRECURSOR` for brand completion.

```ts
const finishSegment = (
  segment: ActiveSegment,
  replacementText = segment.finalText,
) => {
  // write replacementText into the row
};
```

- [ ] **Step 5: Correct the colors**

Set `.ascii-background-segment` to `color: inherit`. Set `.ascii-background-brand` to `color: rgb(101 159 88 / 40%)`.

- [ ] **Step 6: Run the complete automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, the TypeScript check passes, and the Vite production build completes without warnings.

- [ ] **Step 7: Check the live behavior**

Run `pnpm dev` if the local server is not already active, then open `http://127.0.0.1:5173/`. Confirm that ordinary scrambles use the same computed color as the static row. Confirm that `PRECURSOR` is `rgba(101, 159, 88, 0.4)` during the highlight, remains in the row after the highlight, and becomes `rgba(113, 113, 107, 0.08)` without changing text. Confirm that the saved word no longer has an active or brand class; it must be ordinary row text with no protection from later overlapping scrambles.

- [ ] **Step 8: Commit the correction**

```bash
git add src/ascii-reveal.ts src/animated-background.ts src/styles.css tests/ascii-reveal.test.mjs tests/homepage.test.mjs
git commit -m "fix: keep precursor in ascii field"
```

## Chunk 3: Smooth fade to the neutral field

### Task 4: Add a cancellable fade phase

**Files:**
- Modify: `src/ascii-reveal.ts`
- Modify: `src/animated-background.ts`
- Modify: `src/styles.css`
- Test: `tests/ascii-reveal.test.mjs`
- Test: `tests/homepage.test.mjs`

- [ ] **Step 1: Write the failing timing tests**

Add a fake-scheduler test for a 400 ms fade phase after the existing 1.5-second hold. Require `onFade` to receive `PRECURSOR` at 5,000 ms. Require completion at 5,400 ms, and verify that cancellation during the fade prevents completion and removes the pending completion timer.

```js
fakeClock.advanceBy(3500);
assert.equal(revealedText, "PRECURSOR");
fakeClock.advanceBy(1500);
assert.equal(fadingText, "PRECURSOR");
assert.equal(completedText, undefined);
fakeClock.advanceBy(399);
assert.equal(completedText, undefined);
fakeClock.advanceBy(1);
assert.equal(completedText, "PRECURSOR");
```

- [ ] **Step 2: Write the failing source and style tests**

Require the brand highlight to use `rgb(101 159 88 / 50%)`. Require a 400 ms fade class and keyframe from the `50%` accent color to `rgb(113 113 107 / 8%)`. Require `animated-background.ts` to use an explicit fade state and connect the controller's `onFade` callback.

- [ ] **Step 3: Run the focused tests and confirm the expected failures**

Run: `node --test tests/ascii-reveal.test.mjs tests/homepage.test.mjs`

Expected: FAIL because the reveal controller has no fade callback, the accent is still `40%`, and no fade animation exists.

- [ ] **Step 4: Add the fade timing to the reveal controller**

Export `BRAND_FADE_MS = 400`. Extend `startBrandRevealTimeline` with `onFade`. After the 1.5-second hold, call `onFade(BRAND_REVEAL_TEXT)`, then schedule `onComplete(BRAND_REVEAL_TEXT)` after 400 ms. Make `cancel()` stop the reveal, hold, and completion timers.

```ts
export const BRAND_FADE_MS = 400;

onFade(BRAND_REVEAL_TEXT);
cancelCompletion = schedule(() => {
  onComplete(BRAND_REVEAL_TEXT);
}, BRAND_FADE_MS);
```

- [ ] **Step 5: Connect the fade state to row rendering**

Add `isBrandFading` to `ActiveSegment`. The reveal callback sets the visible state. The fade callback sets the fade state and renders again. Completion calls the existing `finishSegment(segment, completionText)` path, so `PRECURSOR` remains in the underlying row.

- [ ] **Step 6: Add the keyframe animation**

Set `.ascii-background-brand` to `rgb(101 159 88 / 50%)`. Add `.ascii-background-brand-fade` with `animation: precursor-brand-fade 400ms ease-out forwards`. Define the keyframe from `rgb(101 159 88 / 50%)` to `rgb(113 113 107 / 8%)`. Keep all square, flat, and reduced-motion behavior unchanged.

- [ ] **Step 7: Run all automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, TypeScript passes, the production build completes, and the diff has no whitespace errors.

- [ ] **Step 8: Check the live behavior**

Run `pnpm dev` if the local server is not active, then open `http://127.0.0.1:5173/`. Confirm that ordinary scrambles remain neutral. Confirm that `PRECURSOR` is `rgba(101, 159, 88, 0.5)` for 1.5 seconds, fades toward the neutral row color over 400 ms, and remains as neutral row text after the fade. Confirm that the terminal remains solid `rgb(250, 250, 250)`.

- [ ] **Step 9: Commit the fade**

```bash
git add src/ascii-reveal.ts src/animated-background.ts src/styles.css tests/ascii-reveal.test.mjs tests/homepage.test.mjs docs/superpowers/specs/2026-08-26-precursor-ascii-reveal-design.md docs/superpowers/plans/2026-08-26-precursor-ascii-reveal.md
git commit -m "feat: fade precursor highlight"
```
