# Selected Stack Centering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vertically center the complete selected card unit while preserving the existing fan offsets and using a 24px selected gap.

**Architecture:** Add one pure centering function to the stack geometry model. The stack controller will calculate the selected offset from the measured card height and selected card's base fan transform, then expose it through one CSS custom property. CSS will apply the property and the 24px gap only in selected nonvertical layouts.

**Tech Stack:** TypeScript, CSS, GSAP, Vite, Node test runner, pnpm

---

## Chunk 1: Selected Stack Geometry

### Task 1: Add the centering contract

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `src/terminal-stack-model.ts`

- [ ] **Step 1: Write the failing geometry test**

Add a test that loads `getSelectedUnitCenterOffset()`. For card heights `565`, `745`, and `760`, and base fan positions `-15`, `-5`, `-5`, and `-15`, calculate the selected card top and navigation pill bottom. Assert that their viewport spaces differ by no more than `0.5px`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm test -- --test-name-pattern="centers the complete selected stack unit"`

Expected: FAIL because `getSelectedUnitCenterOffset` does not exist.

- [ ] **Step 3: Add the pure geometry function**

In `src/terminal-stack-model.ts`, add `pageBottomPadding: 0` to `NONVERTICAL_LAYOUT_GEOMETRY` and export:

```ts
export function getSelectedUnitCenterOffset({
  baseY,
  cardHeight,
}: {
  baseY: number;
  cardHeight: number;
}): number {
  const selectedTopInsideRegion =
    NONVERTICAL_LAYOUT_GEOMETRY.fanTopSpace +
    baseY -
    SELECTED_LIFT -
    SELECTED_SCALE_INCREASE * cardHeight;

  return (
    NONVERTICAL_LAYOUT_GEOMETRY.pageBottomPadding -
    NONVERTICAL_LAYOUT_GEOMETRY.pageTopPadding -
    selectedTopInsideRegion
  ) / 2;
}
```

- [ ] **Step 4: Run the focused test and confirm success**

Run: `pnpm test -- --test-name-pattern="centers the complete selected stack unit"`

Expected: PASS.

### Task 2: Apply the offset and selected gap

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `src/terminal-stack.ts`
- Modify: `src/terminal-stack.css`

- [ ] **Step 1: Write failing controller and CSS contract tests**

Assert that the controller sets `--terminal-active-center-offset` from the measured card height and the active card's base transform, removes it when no card is selected, and recalculates it in the existing measurement path. Assert that the selected `spread` and `compressed` CSS rule uses the custom property and `gap: 24px`, while the base region keeps `gap: 28px`.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test -- --test-name-pattern="selected stack|active center offset"`

Expected: FAIL because the CSS custom property and selected gap do not exist.

- [ ] **Step 3: Apply the controller geometry**

Import `getSelectedUnitCenterOffset` in `src/terminal-stack.ts`. Store the latest measured card height. When an active card exists in `spread` or `compressed`, calculate its offset from `getCurrentTransforms()[selectedIndex].y` and set `--terminal-active-center-offset`. Remove the property for overview, vertical, and reduced-motion states. Use the existing measurement and selection paths so resize and card changes both recalculate the value.

- [ ] **Step 4: Apply the selected CSS**

Replace the fixed `translateY(-20px)` with:

```css
transform: translateY(var(--terminal-active-center-offset, 0px));
gap: 24px;
```

Keep the base `gap: 28px` rule unchanged.

- [ ] **Step 5: Run the focused tests and confirm success**

Run: `pnpm test -- --test-name-pattern="selected stack|active center offset"`

Expected: PASS.

### Task 3: Verify the complete change

**Files:**
- Verify: `src/terminal-stack-model.ts`
- Verify: `src/terminal-stack.ts`
- Verify: `src/terminal-stack.css`
- Verify: `tests/homepage.test.mjs`

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Run type and build checks**

Run: `pnpm typecheck && pnpm build`

Expected: both commands succeed.

- [ ] **Step 3: Check the local page**

At several laptop viewport heights, select sessions 01 through 04. Confirm that each selected unit has equal top and bottom space, the small fan offsets remain, the selected gap is 24px, and overview returns to 28px.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/terminal-stack-model.ts src/terminal-stack.ts src/terminal-stack.css tests/homepage.test.mjs
git commit -m "fix selected stack vertical centering"
```
