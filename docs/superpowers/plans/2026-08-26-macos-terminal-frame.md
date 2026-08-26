# macOS Terminal Frame Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing terminal a compact macOS title bar and reduce its desktop width to 760px.

**Architecture:** Keep the current semantic HTML, vanilla CSS, transcript, and analytics. Add only decorative title-bar spans and focused CSS rules.

**Tech Stack:** HTML, CSS, Node test runner, Vite, TypeScript

---

## Chunk 1: Focused frame update

### Task 1: Define the frame contract

**Files:**
- Modify: `tests/homepage.test.mjs`

- [ ] Add assertions for the decorative traffic lights, centered three-column title bar, exact control colors, 760px width, 36px title bar, small-screen session rule, square corners, and no shadow or gradient.
- [ ] Run `pnpm test` and confirm the new assertions fail because the frame is not present.

### Task 2: Implement and verify the frame

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

- [ ] Add the decorative traffic-light spans and update the title text.
- [ ] Add the grid title bar, exact colors, 760px maximum width, and 420px session breakpoint.
- [ ] Run `pnpm test`, `pnpm check`, and `pnpm build`.
- [ ] Check desktop and mobile layouts in a browser and confirm internal scrolling.
- [ ] Commit the focused change.
