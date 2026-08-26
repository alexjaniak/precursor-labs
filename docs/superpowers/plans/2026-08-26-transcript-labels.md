# Transcript Labels Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten the five terminal section commands and combine the research and interests content into one entry.

**Architecture:** Keep the static semantic HTML structure. Change only the command text and the research/interests entry boundary. Keep body copy, links, analytics attributes, the terminal title, and all CSS unchanged.

**Tech Stack:** HTML, Node test runner

---

## Chunk 1: Transcript labels and structure

### Task 1: Update the command transcript

**Files:**
- Modify: `tests/homepage.test.mjs`
- Modify: `index.html`

- [ ] **Step 1: Write the failing source test**

Update the transcript test to require these commands in this order:

```js
const commands = [
  "about",
  "thesis",
  "research and interests",
  "backers",
  "team experience",
];
```

Require exactly five transcript entries. Require one entry to contain the `research and interests` command and both existing research paragraphs. Require no command span to contain a `precursor` prefix.

Before changing the HTML, replace the current prefix-only body checks with exact assertions for all four complete paragraphs. Add an exact mapping check for every backer and experience link. Each mapping must preserve the visible label, URL, `data-track-link-name`, and `data-track-link-category`:

```js
[
  ["Blockchain Capital", "https://www.blockchaincapital.com/", "blockchain_capital", "backer"],
  ["Reforge", "https://reforge.vc/", "reforge", "backer"],
  ["Blockchain Builders Fund", "https://www.blockchainbuilders.fund/", "blockchain_builders_fund", "backer"],
  ["AWS", "https://aws.amazon.com/", "aws", "experience"],
  ["Stanford", "https://www.stanford.edu/", "stanford", "experience"],
  ["Northrop Grumman RL", "https://www.northropgrumman.com/", "northrop_grumman_rl", "experience"],
  ["Duke", "https://duke.edu/", "duke", "experience"],
  ["Centerview Partners", "https://www.centerviewpartners.com/", "centerview_partners", "experience"],
  ["Berkeley", "https://www.berkeley.edu/", "berkeley", "experience"],
  ["Cornell", "https://www.cornell.edu/", "cornell", "experience"],
  ["Harvard", "https://www.harvard.edu/", "harvard", "experience"],
]
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `node --test --test-name-pattern="approved command transcript" tests/homepage.test.mjs`

Expected: FAIL because the current commands still use the `precursor` prefix and research and interests are separate entries.

- [ ] **Step 3: Make the minimal HTML change**

Change the command spans to `about`, `thesis`, `research and interests`, `backers`, and `team experience`. Remove the closing and opening section tags between the current research and interests paragraphs so both paragraphs remain inside one transcript entry. Do not change the terminal title, copy, links, analytics attributes, or styles.

- [ ] **Step 4: Run all automated checks**

Run: `pnpm test && pnpm run build && git diff --check`

Expected: all tests pass, TypeScript passes, the production build completes, and the diff has no whitespace errors.

- [ ] **Step 5: Check localhost**

Run `pnpm dev` if needed and open `http://127.0.0.1:5173/`. Confirm the five new labels appear in order and the combined entry contains both paragraphs.

- [ ] **Step 6: Commit the change**

```bash
git add tests/homepage.test.mjs index.html
git commit -m "feat: simplify transcript labels"
```
