# Writing Exclusions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four approved articles from the writings window and prevent automatic sync from adding them again.

**Architecture:** Store canonical exclusion URLs beside the writing sources. Validate and canonicalize them before network access, then filter the merged saved and fetched records before JSON and HTML output.

**Tech Stack:** TypeScript, JSON, Node test runner through `tsx`, `pnpm`, static HTML.

**Design specification:** `docs/superpowers/specs/2026-08-26-writing-exclusions-design.md`

---

## File structure

- `config/writing-sources.json`: owns the four editorial exclusion URLs.
- `scripts/sync-writings.mts`: validates exclusions and filters final sync records.
- `tests/writings-sync.test.mjs`: covers validation, canonical matching, saved and fetched filtering, and the checked-in archive.
- `data/writings.json`: removes the four current records.
- `index.html`: removes the four generated writing rows.

## Chunk 1: Permanent writing exclusions

### Task 1: Add the tested exclusion contract

**Files:**

- Modify: `tests/writings-sync.test.mjs`
- Modify: `config/writing-sources.json`
- Modify: `scripts/sync-writings.mts`

- [ ] **Step 1: Write failing sync tests**

Add one test that puts a URL in saved data and in fetched RSS. Cover query, fragment, and final-slash variants as three explicit cases. Require the final JSON and HTML to omit them while a different historical record remains. Add table-driven invalid-config cases for a non-array value, duplicate canonical values, HTTP, credentials, and invalid text. Require zero fetch calls and zero write operations for each invalid case. Keep one test that omits `excludedUrls` and confirms the current empty-list behavior.

Update the existing source-configuration test first. Require its expected object to contain the exact four canonical `excludedUrls` values before changing the configuration file.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs
```

Expected: FAIL because the sync does not parse or apply `excludedUrls`.

- [ ] **Step 3: Add the minimal configuration and sync code**

Extend `WritingConfig` with `excludedUrls: string[]`. In `parseConfig`, treat a missing value as `[]`; reject a present non-array value. Canonicalize each entry with the existing safe HTTPS Substack URL canonicalizer, then call the existing uniqueness check on the canonical results.

After the current merge, filter by the canonical exclusion set:

```ts
const excluded = new Set(config.excludedUrls);
const merged = mergeWritings(historical, fetched).filter(({ url }) => !excluded.has(url));
```

Add the four approved canonical URLs to `config/writing-sources.json`.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs
```

Expected: all writings sync tests pass.

### Task 2: Update the checked-in output

**Files:**

- Modify: `data/writings.json`
- Modify: `index.html`
- Modify: `tests/writings-sync.test.mjs`

- [ ] **Step 1: Make the archive assertions exact**

Add the four URLs to an `excludedUrls` test constant. Require every URL to be absent from parsed canonical data and the generated list. The homepage test already reads its exact list from `data/writings.json`, so do not change `tests/homepage.test.mjs`.

- [ ] **Step 2: Run the focused tests and confirm the expected failure**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs tests/homepage.test.mjs
```

Expected: FAIL because the checked-in JSON and HTML still contain the four rows.

- [ ] **Step 3: Remove the four records and generated rows**

Delete only the four matching objects from `data/writings.json` and the four matching `<li>` rows inside the writings markers in `index.html`.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm test
pnpm run check
pnpm run build
git diff --check
```

Expected: all tests pass, the type check and build finish with exit code 0, and the diff check has no output.

- [ ] **Step 5: Preserve unrelated work**

Confirm that the existing deletion of `artifacts/precursor-twitter-banner.png` and the existing terminal-layout changes in `src/terminal-stack.css` and `tests/homepage.test.mjs` remain unchanged and are not staged with this fix.
