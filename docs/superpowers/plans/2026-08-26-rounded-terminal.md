# Rounded Terminal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the terminal window an 8px outer corner radius.

**Architecture:** Keep the existing terminal component and clipping behavior. Add one source-contract assertion, then change only the outer terminal radius.

**Tech Stack:** CSS, Node test runner

---

## Chunk 1: Terminal corners

### Task 1: Round the terminal window

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Change the compact macOS terminal frame test to add a selector-scoped assertion that `.terminal` uses both `border-radius: 8px` and `overflow: hidden`. The radius requirement must fail before the CSS change, while the clipping requirement protects the existing header and body behavior.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `node --test --test-name-pattern="compact macOS terminal frame" tests/homepage.test.mjs`

Expected: FAIL because `.terminal` still uses `border-radius: 0`.

- [ ] **Step 3: Make the minimal CSS change**

Change only the `.terminal` declaration:

```css
border-radius: 8px;
```

- [ ] **Step 4: Run all automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, TypeScript passes, the production build completes, and the diff has no whitespace errors.

- [ ] **Step 5: Check localhost**

Run `pnpm dev` if the local server is not active. Open `http://127.0.0.1:5173/` and confirm the terminal has 8px outer corners, the header and body clip cleanly, and no other visual rule changed.

- [ ] **Step 6: Commit the change**

```bash
git add tests/homepage.test.mjs src/styles.css
git commit -m "feat: round terminal corners"
```
