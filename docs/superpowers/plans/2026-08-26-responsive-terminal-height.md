# Responsive Terminal Height Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the responsive terminal height subtraction from 24px to 12px.

**Architecture:** Keep the existing media query and all related layout rules. Add one source-contract assertion, then change one CSS value.

**Tech Stack:** CSS, Node test runner

---

## Chunk 1: Responsive height

### Task 1: Increase the responsive terminal height

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

In the responsive-terminal test, require the existing media query to contain `height: calc(100svh - 12px)`. Also require the same rule to keep `width: calc(100vw - 24px)` so the height change does not alter the width.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `node --test --test-name-pattern="responsive terminal" tests/homepage.test.mjs`

Expected: FAIL because the CSS still uses `height: calc(100svh - 24px)`.

- [ ] **Step 3: Make the minimal CSS change**

Change only this declaration inside the existing responsive media query:

```css
height: calc(100svh - 12px);
```

- [ ] **Step 4: Run all automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, TypeScript passes, the production build completes, and the diff has no whitespace errors.

- [ ] **Step 5: Check localhost at a responsive viewport**

Run `pnpm dev` if the local server is not active. Open `http://127.0.0.1:5173/` at a viewport of 600px by 700px. Confirm the computed terminal height is 688px and the width still uses the existing 24px subtraction.

- [ ] **Step 6: Commit the change**

```bash
git add tests/homepage.test.mjs src/styles.css
git commit -m "fix: increase responsive terminal height"
```
