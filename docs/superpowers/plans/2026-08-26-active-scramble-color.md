# Active Scramble Color Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render all active ASCII scramble segments in the accent green at 25% opacity.

**Architecture:** Keep the existing active-segment class and render state. Change its color only, while the later brand and fade classes continue to override it during their phases.

**Tech Stack:** CSS, Node test runner

---

## Chunk 1: Active scramble color

### Task 1: Color active scramble symbols

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Replace the ordinary active-segment color test with this exact name and assertion:

```js
test("uses 25% green for active ASCII scramble segments", () => {
  assert.match(
    css,
    /\.ascii-background-segment\s*\{[^}]*color:\s*rgb\(101 159 88 \/ 25%\)/s,
  );
});
```

Keep the static row assertion at `rgb(113 113 107 / 8%)`, the resolved brand assertion at 50%, and the fade keyframe assertions unchanged.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `node --test --test-name-pattern="active ASCII scramble" tests/homepage.test.mjs`

Expected: FAIL because `.ascii-background-segment` still uses `color: inherit`.

- [ ] **Step 3: Make the minimal CSS change**

Change only the active segment declaration:

```css
.ascii-background-segment {
  color: rgb(101 159 88 / 25%);
}
```

- [ ] **Step 4: Run all automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, TypeScript passes, the production build completes, and the diff has no whitespace errors.

- [ ] **Step 5: Check the live animation**

Run `pnpm dev` if the local server is not active. Open `http://127.0.0.1:5173/`. Confirm an active scramble computes to `rgba(101, 159, 88, 0.25)`, the surrounding row remains `rgba(113, 113, 107, 0.08)`, and a resolved `PRECURSOR` remains `rgba(101, 159, 88, 0.5)`.

- [ ] **Step 6: Commit the change**

```bash
git add tests/homepage.test.mjs src/styles.css
git commit -m "feat: color active ascii scrambles"
```
