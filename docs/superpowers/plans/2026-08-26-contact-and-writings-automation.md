# Contact and Writings Automation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure terminal contact form that posts to Slack through a Cloudflare Worker and a daily static writings updater for Substack posts and X Articles.

**Architecture:** Keep the GitHub Pages frontend static. Put contact delivery in a separate Cloudflare Worker with Turnstile verification, and keep writings generation in deterministic Node scripts that update checked-in JSON and a marked HTML section. A scheduled GitHub Action commits cursor or content changes and deploys changed site content directly.

**Tech Stack:** Vite 5, TypeScript, IBM Plex Mono, Cloudflare Workers and Turnstile, Slack incoming webhooks, GitHub Actions, Substack RSS, X API v2, `pnpm`, Node test runner through `tsx`.

**Design specification:** `docs/superpowers/specs/2026-08-26-contact-and-writings-automation-design.md`

---

## File structure

Contact:

- `index.html`: semantic Session 04 form markup and Turnstile mount point.
- `src/contact-form.ts`: browser configuration, Turnstile lifecycle, form submission, and cleanup.
- `src/styles.css`: terminal form styles.
- `src/main.ts`: starts and cleans up the contact controller.
- `src/vite-env.d.ts`: public Vite configuration types.
- `worker/contact.ts`: isolated contact request handler and Slack delivery.
- `worker/wrangler.toml`: Worker entry point and public configuration.
- `tests/contact-worker.test.mjs`: Worker protocol and security tests.
- `tests/contact-form.test.mjs`: client behavior and source contract tests.

Writings:

- `data/writings.json`: canonical retained writing records.
- `data/writing-sync-state.json`: durable X `since_id` values.
- `config/writing-sources.json`: four Substack feeds and four X author mappings.
- `scripts/lib/writings.ts`: pure parsing, normalization, merge, sort, and rendering functions.
- `scripts/sync-writings.mts`: network orchestration and atomic output writes.
- `index.html`: generated writings markers around the existing list rows.
- `tests/writings-sync.test.mjs`: deterministic fixtures for parsing and rendering.
- `.github/workflows/sync-writings.yml`: daily update, commit, build, and direct Pages deploy.
- `.github/workflows/deploy.yml`: passes the two public contact variables.

Shared:

- `package.json` and `pnpm-lock.yaml`: scripts plus `fast-xml-parser` and `wrangler` development dependencies.
- `tests/homepage.test.mjs`: updated static writings and contact contracts.

## Chunk 1: Secure contact path

### Task 1: Implement and test the Cloudflare Worker

**Files:**

- Create: `worker/contact.ts`
- Create: `worker/wrangler.toml`
- Create: `tests/contact-worker.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the required tool and failing Worker tests**

Use `pnpm add -D wrangler`. Write tests that import the Worker and inject fake Siteverify and Slack `fetch` results. Cover exact origins, preflight headers, method, content type, 8192-byte limit, accepted keys, field limits, honeypot, Turnstile action and hostname, inert Slack plain text, Slack failure, and Siteverify failure.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
pnpm exec tsx --test tests/contact-worker.test.mjs
```

Expected: FAIL because `worker/contact.ts` does not exist.

- [ ] **Step 3: Implement the Worker contract**

Export an environment type, an injectable `createContactHandler(fetchImpl)`, and the default Worker handler. Keep all JSON responses in this shape:

```ts
type ContactResponse =
  | { ok: true }
  | {
      ok: false;
      code:
        | "invalid_request"
        | "origin_not_allowed"
        | "verification_failed"
        | "method_not_allowed"
        | "request_too_large"
        | "unsupported_media_type"
        | "delivery_failed"
        | "verification_unavailable";
    };
```

Use plain-text Slack block fields. Never log the request body. Enforce the spec's exact validation, CORS, timeout, and response rules.

- [ ] **Step 4: Add reproducible Worker configuration**

Set `name = "precursor-contact"`, `main = "contact.ts"`, `compatibility_date = "2026-08-26"`, `ALLOWED_ORIGIN = "https://precursorlabs.org"`, and `TURNSTILE_HOSTNAME = "precursorlabs.org"` in `worker/wrangler.toml`. Document `SLACK_WEBHOOK_URL` and `TURNSTILE_SECRET_KEY` only as secret names. Add these exact package scripts, which use the local binary through `pnpm`:

```json
{
  "contact:dev": "wrangler dev --config worker/wrangler.toml",
  "contact:deploy": "wrangler deploy --config worker/wrangler.toml",
  "contact:secret:slack": "wrangler secret put SLACK_WEBHOOK_URL --config worker/wrangler.toml",
  "contact:secret:turnstile": "wrangler secret put TURNSTILE_SECRET_KEY --config worker/wrangler.toml"
}
```

The external setup commands are:

```bash
pnpm run contact:secret:slack
pnpm run contact:secret:turnstile
pnpm run contact:deploy
```

- [ ] **Step 5: Run the Worker test**

Run:

```bash
pnpm exec tsx --test tests/contact-worker.test.mjs
```

Expected: all Worker tests pass.

### Task 2: Implement and test the terminal contact form

**Files:**

- Modify: `index.html`
- Create: `src/contact-form.ts`
- Modify: `src/main.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/styles.css`
- Create: `tests/contact-form.test.mjs`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Write failing client and markup tests**

Require `$ contact --new`, associated labels, exact field names and limits, honeypot isolation, disabled no-configuration state, `aria-live`, terminal form CSS, Turnstile action `contact`, single-submit behavior, retry preservation, token reset after every response, and cleanup.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
pnpm exec tsx --test tests/contact-form.test.mjs tests/homepage.test.mjs
```

Expected: FAIL because Session 04 is still a placeholder and the controller is absent.

- [ ] **Step 3: Add the semantic form markup and styles**

Keep every form control outside the title-bar button. Use square 1px fields, compact labels, no shadow, and green only for focus, submit, and success. Keep the terminal body internally scrollable.

- [ ] **Step 4: Implement the controller**

Load Turnstile only when both public values exist. Render explicitly with a flexible light widget and action `contact`. Disable submit until a token exists. Post JSON to `VITE_CONTACT_ENDPOINT`. Preserve values on failure, clear message on success, and reset the widget after every request. Return one idempotent cleanup function.

- [ ] **Step 5: Start and clean up the controller from `main.ts`**

Use the current page lifecycle. Do not add Mixpanel events because the form contains personal information and no contact event is approved.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
pnpm exec tsx --test tests/contact-form.test.mjs tests/homepage.test.mjs
```

Expected: all contact and homepage tests pass.

## Chunk 2: Deterministic writings updater

### Task 3: Seed canonical writings data and pure transformations

**Files:**

- Create: `data/writings.json`
- Create: `data/writing-sync-state.json`
- Create: `config/writing-sources.json`
- Create: `scripts/lib/writings.ts`
- Create: `tests/writings-sync.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add XML parsing and failing fixture tests**

Use `pnpm add -D fast-xml-parser`. Test RSS single and multiple item shapes, CDATA titles, UTC dates, URL canonicalization, unsafe URL rejection, X Article field variants, normal/reply/repost/quote exclusion, deterministic duplicate winners, retained historical rows, and stable sorting.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs
```

Expected: FAIL because the pure writings module does not exist.

- [ ] **Step 3: Seed the data and source configuration**

Copy the existing 30 visible records into `data/writings.json`, including source type. Start `data/writing-sync-state.json` with an empty `xAccounts` object. Add the four reviewed Substack and X mappings to `config/writing-sources.json`.

- [ ] **Step 4: Implement pure transformations**

Export typed functions for RSS parsing, X response parsing, canonical URL validation, merging, sorting, JSON formatting, HTML escaping, and marked-list rendering. Use raw code point comparison, not locale-sensitive comparison.

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs
```

Expected: all writings transformation tests pass.

### Task 4: Implement network sync and static HTML generation

**Files:**

- Create: `scripts/sync-writings.mts`
- Modify: `index.html`
- Modify: `package.json`
- Modify: `tests/writings-sync.test.mjs`
- Modify: `tests/homepage.test.mjs`

- [ ] **Step 1: Add failing orchestration and marker tests**

Test exact `<!-- WRITINGS:START -->` and `<!-- WRITINGS:END -->` markers, byte preservation outside markers, missing-token X skip, per-source failure retention, X pagination with `since_id`, cursor advance only after complete success, first-run 30-day start, idempotent outputs, and complete failure behavior.

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs tests/homepage.test.mjs
```

Expected: FAIL because the sync orchestrator and markers do not exist.

- [ ] **Step 3: Add the markers without changing visible rows**

Place the markers immediately inside the existing `data-writing-list`. Regenerate the current rows from `data/writings.json` and verify the visible archive is unchanged.

- [ ] **Step 4: Implement the sync command**

Use injected `fetch` and filesystem adapters for tests. Fetch all Substack sources. If `X_API_BEARER_TOKEN` exists:

1. Resolve the four handles with `GET /2/users/by?usernames=<comma-separated>&user.fields=username`.
2. Fetch each timeline with `GET /2/users/{id}/tweets?max_results=100&exclude=replies,retweets&tweet.fields=article,article_title,created_at,referenced_tweets`.
3. On later pages, add `pagination_token=<next_token>`. On a later account run, add its saved `since_id`. On its first run, add a UTC `start_time` exactly 30 days before the run time.
4. Reject every item with any `referenced_tweets` entry. Accept only a non-null `article` object with a title from `article.title`, then a string `article_title`, then `article_title.title`.
5. Store the canonical URL `https://x.com/{username}/status/{id}` and convert `created_at` to its UTC `YYYY-MM-DD` date.
6. Advance that account's `since_id` only after every page succeeds.

Write valid results from successful sources while retaining the previous records for a failed source. If every requested Substack source fails and every requested X source either fails or is unavailable, exit nonzero and do not write any file. Write all validated outputs atomically.

- [ ] **Step 5: Add the package command**

Add:

```json
"sync:writings": "tsx scripts/sync-writings.mts"
```

- [ ] **Step 6: Run a real Substack-only sync twice**

Run the command without an X token. The first run may add current Substack records:

```bash
env -u X_API_BEARER_TOKEN pnpm run sync:writings
```

Record the generated file hashes, run the same command again, and compare them:

```bash
shasum -a 256 data/writings.json data/writing-sync-state.json index.html > /tmp/precursor-writings-before.sha256
env -u X_API_BEARER_TOKEN pnpm run sync:writings
shasum -a 256 -c /tmp/precursor-writings-before.sha256
git diff --check
```

The second run must have identical generated files.

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm exec tsx --test tests/writings-sync.test.mjs tests/homepage.test.mjs
```

Expected: writings and homepage tests pass.

## Chunk 3: Daily deployment and final verification

### Task 5: Add and test the scheduled workflow

**Files:**

- Create: `.github/workflows/sync-writings.yml`
- Modify: `.github/workflows/deploy.yml`
- Create: `tests/writings-workflow.test.mjs`

- [ ] **Step 1: Write the failing workflow source test**

Require daily `17 9 * * *`, manual dispatch, `contents: write`, `pages: write`, `id-token: write`, pnpm setup, X secret use, contact variable use, sync, focused tests, build, three-file selective commit, change-gated Pages artifact upload, and explicit deploy job.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
pnpm exec tsx --test tests/writings-workflow.test.mjs
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement the workflow**

Use one `sync-build` job and one `deploy` job with a shared `pages` concurrency group. The `sync-build` job must use these exact actions and commands:

1. `actions/checkout@v4` with the branch ref.
2. `pnpm/action-setup@v4` with version `9.13.1`.
3. `actions/setup-node@v4` with Node 22 and the pnpm cache.
4. `pnpm install --frozen-lockfile`.
5. `pnpm run sync:writings` with `X_API_BEARER_TOKEN: ${{ secrets.X_API_BEARER_TOKEN }}`.
6. `pnpm exec tsx --test tests/writings-sync.test.mjs tests/homepage.test.mjs tests/writings-workflow.test.mjs`.
7. `pnpm run build` with `VITE_MIXPANEL_TOKEN: ${{ secrets.VITE_MIXPANEL_TOKEN }}`, `VITE_CONTACT_ENDPOINT: ${{ vars.VITE_CONTACT_ENDPOINT }}`, and `VITE_TURNSTILE_SITE_KEY: ${{ vars.VITE_TURNSTILE_SITE_KEY }}`.
8. Expose two job outputs: `any_changed` from `git diff --quiet -- data/writings.json data/writing-sync-state.json index.html`, and `site_changed` from `git diff --quiet -- index.html` only.
9. When `any_changed == 'true'`, set the Git identity to `github-actions[bot]`, run `git add -- data/writings.json data/writing-sync-state.json index.html`, commit with `chore: sync writings`, and push to the checked-out branch.
10. When `site_changed == 'true'`, upload `dist` with `actions/upload-pages-artifact@v3`.

The `deploy` job must need `sync-build`, run only when `site_changed == 'true'`, use `actions/deploy-pages@v4`, and use the `github-pages` environment with its URL from the deployment output. Preserve manual dispatch. The workflow permissions must be `contents: write`, `pages: write`, and `id-token: write`.

- [ ] **Step 4: Pass contact public variables in the existing deploy workflow**

Add `VITE_CONTACT_ENDPOINT: ${{ vars.VITE_CONTACT_ENDPOINT }}` and `VITE_TURNSTILE_SITE_KEY: ${{ vars.VITE_TURNSTILE_SITE_KEY }}` next to the Mixpanel token.

- [ ] **Step 5: Run the workflow test**

Run:

```bash
pnpm exec tsx --test tests/writings-workflow.test.mjs
```

Expected: workflow tests pass.

### Task 6: Verify, deploy what credentials permit, and preserve user work

**Files:**

- Verify all changed files.
- Do not change existing staged favicon files or the deleted banner artifact.

- [ ] **Step 1: Run complete verification**

```bash
pnpm test
pnpm run check
pnpm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Run a local browser pass**

Check Session 04 at normal laptop and compact sizes. Verify labels, wrapping, internal scroll, disabled local configuration status, focus states, and no console error.

- [ ] **Step 3: Check external access without exposing secrets**

Check `wrangler whoami`, GitHub authentication, and available repository variables and secrets by name only. Never print secret values.

- [ ] **Step 4: Complete permitted external setup**

If authenticated accounts and required permissions exist, create the Worker, Turnstile widget, Slack webhook for channel `C0BT1GQ4BL1`, repository variables, and X secret. If a login, payment, workspace permission, or token creation needs the user, stop only that external step and leave exact setup commands and fields.

- [ ] **Step 5: Run live smoke tests when configured**

Send one non-personal test contact, confirm it appears only in the target channel, and manually run the writings workflow. Verify the deployed page after completion.

- [ ] **Step 6: Commit only feature changes**

First record the exact starting state and the staged favicon patch:

```bash
git status --short > /tmp/precursor-start-status.txt
git diff --cached --binary -- index.html public/android-chrome-192x192.png public/android-chrome-512x512.png public/apple-touch-icon.png public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico public/site.webmanifest tests/favicon.test.mjs > /tmp/precursor-favicon-staged.patch
```

Temporarily unstage only that exact list without changing the working files:

```bash
git restore --staged -- index.html public/android-chrome-192x192.png public/android-chrome-512x512.png public/apple-touch-icon.png public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico public/site.webmanifest tests/favicon.test.mjs
```

Stage every new feature file explicitly. Use `git add -p index.html` and select only the contact and generated-writings hunks. Inspect `git diff --cached --stat` and `git diff --cached` before committing. Commit the feature. Then restore the original staged favicon list:

```bash
git add -- index.html public/android-chrome-192x192.png public/android-chrome-512x512.png public/apple-touch-icon.png public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico public/site.webmanifest tests/favicon.test.mjs
git diff --cached --binary -- index.html public/android-chrome-192x192.png public/android-chrome-512x512.png public/apple-touch-icon.png public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico public/site.webmanifest tests/favicon.test.mjs > /tmp/precursor-favicon-restored.patch
diff -u /tmp/precursor-favicon-staged.patch /tmp/precursor-favicon-restored.patch
```

Finally verify that those same favicon paths are staged and that `artifacts/precursor-twitter-banner.png` is still an unstaged deletion. Do not restore, stage, commit, or delete the banner artifact.
