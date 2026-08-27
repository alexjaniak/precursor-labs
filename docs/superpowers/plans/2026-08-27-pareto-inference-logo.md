# Pareto Inference Logo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the approved Pareto Inference mark with and without its black background.

**Architecture:** Keep each deliverable as a small, self-contained SVG with the same 240 by 240 geometry. Verify the source contract, then render 1024 by 1024 PNG previews with `rsvg-convert`.

**Tech Stack:** SVG, Node test runner through `tsx`, and `rsvg-convert`.

---

## Chunk 1: Final logo assets

### Task 1: Define the vector contract

**Files:**
- Create: `tests/pareto-inference-logo.test.mjs`
- Create: `exports/pareto-inference-mark.svg`
- Create: `exports/pareto-inference-mark-transparent.svg`

- [ ] Add a focused test for the view box, palette, geometry, transparent canvas, and layer order.
- [ ] Run the focused test and confirm that it fails because the SVG files do not exist.
- [ ] Create the two approved SVG files.
- [ ] Run the focused test and confirm that it passes.

### Task 2: Render and inspect the PNG previews

**Files:**
- Create: `exports/pareto-inference-mark.png`
- Create: `exports/pareto-inference-mark-transparent.png`

- [ ] Render both SVG files to 1024 by 1024 PNG files with `rsvg-convert`.
- [ ] Verify both PNG dimensions.
- [ ] Inspect both rendered marks for clean connections and correct transparency.
- [ ] Run the complete test suite and production build.
