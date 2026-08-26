# Contact and Writings Automation Design

## Goal

Complete the fourth terminal with a compact contact form that sends new messages to the selected Precursor Labs Slack channel. Add a daily writings updater that keeps the second terminal current from the four existing Substack publications and X Articles from the same four authors.

## Selected approach

Keep the public site on GitHub Pages.

- Use a small Cloudflare Worker as the private contact endpoint.
- Store the Slack webhook and Turnstile secret only as Cloudflare Worker secrets.
- Use Cloudflare Turnstile plus a honeypot field for free spam protection.
- Use a scheduled GitHub Action for the writings updater.
- Use official Substack RSS feeds.
- Use the official X API and accept only posts with an `article` object.
- Preserve the generated writings as static HTML so the terminal remains readable without JavaScript.

Do not add a database, contact-form vendor, new analytics provider, or client-visible Slack credential.

## Contact terminal

Session 04 keeps the existing terminal frame and title. Its body contains:

- `$ contact --new`
- Name input
- Email input
- Message textarea
- Hidden honeypot input
- Cloudflare Turnstile challenge
- `send_message` submit button
- An `aria-live` status line

The form uses the existing IBM Plex Mono type, 1px borders, square input corners, muted labels, and green only for focus, submit, and success states. It has no card, shadow, gradient, or animation other than the existing stack motion. The inputs remain separate from the title-bar selection button.

The browser validates required fields and length limits before it sends JSON. While sending, the button is disabled and the status reads `sending...`. A successful response clears the message field and reads `message_sent`. A failed response keeps the entered values and shows a short retry message.

Render Turnstile explicitly with action `contact` and retain its widget ID. Its success callback supplies the token. Error, expiry, and timeout callbacks clear the token, reset the widget, and keep submit unavailable until a new token exists. Reset the widget after every completed request, including Slack delivery failure, because tokens expire after five minutes and can be used only once.

Builds without both a configured endpoint and site key keep the form visible, disable submit, do not load Turnstile, and show `contact_channel_unavailable` immediately. This makes local visual work safe and prevents accidental messages.

## Contact Worker

The Worker exposes one `POST /contact` endpoint and its `OPTIONS` preflight. Other paths return the method response contract without a separate health endpoint.

For each contact request it:

1. Allows `https://precursorlabs.org`, `http://127.0.0.1:5173`, and `http://localhost:5173`. A contact request without one of these exact `Origin` values is rejected.
2. Answers an allowed `OPTIONS /contact` request with `204`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, the exact `Access-Control-Allow-Origin`, and `Vary: Origin`.
3. Adds the exact allowed origin, `Vary: Origin`, and `Cache-Control: no-store` to every contact response.
4. Rejects non-JSON requests and bodies larger than 8192 bytes, measured both from `Content-Length` when present and after reading the body.
5. Accepts only string values for `name`, `email`, `message`, `website`, and `turnstileToken`; unknown keys are rejected.
6. Trims and validates name at 2–100 characters, email at 5–254 characters with one `@`, no whitespace or line breaks, message at 10–2800 characters, an empty `website`, and a Turnstile token at 1–2048 characters. The message limit stays below Slack's 3000-character text-object limit.
7. Verifies the Turnstile token with Cloudflare using a 10-second timeout and the connecting IP.
8. Requires `success: true`, action `contact`, and hostname `precursorlabs.org`. Test configuration separately permits Cloudflare's documented local test response.
9. Sends one formatted Slack message through an incoming webhook.
10. Returns a small JSON result with the correct CORS headers.

The Slack destination is channel ID `C0BT1GQ4BL1`, selected from the supplied channel URL. Slack binds an incoming webhook to its selected channel, so the Worker does not send or configure a channel ID. The one-time live test must confirm the selected webhook posts to `C0BT1GQ4BL1`.

Use `plain_text` Block Kit fields for name, email, and message. Do not render user values as `mrkdwn`. Tests include `&`, `<`, `>`, `<!channel>`, `<@USER>`, and link-like content and require them to remain inert text. The Worker does not store form values and must not log the request body.

The response contract is exact:

- `200 {"ok":true}` after Slack accepts the message.
- `400 {"ok":false,"code":"invalid_request"}` for malformed JSON, unknown keys, wrong types, or invalid fields.
- `403 {"ok":false,"code":"origin_not_allowed"}` for a missing or disallowed origin.
- `403 {"ok":false,"code":"verification_failed"}` for honeypot or rejected Turnstile data.
- `405 {"ok":false,"code":"method_not_allowed"}` for other methods.
- `413 {"ok":false,"code":"request_too_large"}` for an oversized body.
- `415 {"ok":false,"code":"unsupported_media_type"}` for non-JSON contact data.
- `502 {"ok":false,"code":"delivery_failed"}` when Slack rejects delivery.
- `503 {"ok":false,"code":"verification_unavailable"}` when Siteverify cannot be reached.

Worker secrets:

- `SLACK_WEBHOOK_URL`
- `TURNSTILE_SECRET_KEY`

Worker configuration:

- `ALLOWED_ORIGIN=https://precursorlabs.org`
- `TURNSTILE_HOSTNAME=precursorlabs.org`

Public site build configuration:

- `VITE_CONTACT_ENDPOINT`
- `VITE_TURNSTILE_SITE_KEY`

## Writings source data

Move the canonical writings records into `data/writings.json`. Keep per-account X cursors in `data/writing-sync-state.json`. Each item has:

- `title`
- `author`
- `publishedAt` in `YYYY-MM-DD` form
- `url`
- `source` as `substack` or `x-article`

The existing 30 records seed the file. Older records are never removed only because an RSS feed or API response no longer returns them.

Configured Substack publications:

- `https://dylanvu.substack.com/feed` → `dylan vu`
- `https://handsdiff.substack.com/feed` → `hands`
- `https://impermanentfoundation.substack.com/feed` → `Jakub Janiak`
- `https://collectgarbage.substack.com/feed` → `Alex Janiak`

Configured X accounts:

- `@dylanduyvu` → `dylan vu`
- `@handsdiff` → `hands`
- `@oogway_defi` → `Jakub Janiak`
- `@0xjaniak` → `Alex Janiak`

## Daily writings update

A TypeScript sync command performs these steps:

1. Read the checked-in writings JSON.
2. Fetch each configured Substack RSS feed.
3. Normalize publication title, date, author, and canonical URL.
4. If `X_API_BEARER_TOKEN` is present, resolve all four handles with `GET /2/users/by?usernames=...&user.fields=username`.
5. Fetch each timeline with `GET /2/users/{id}/tweets`, `max_results=100`, `exclude=replies,retweets`, and `tweet.fields=article,article_title,created_at,referenced_tweets`.
6. Pass the saved `since_id` and follow every `meta.next_token` page. On the first successful account run, use a 30-day UTC `start_time`; later runs have no lookback cap and advance `since_id` only after every page for that account succeeds. This prevents a failed or delayed run from advancing past unseen posts.
7. Reject any record with `referenced_tweets`, including quote posts. Accept a record only when `article` is a non-null object and a non-empty title exists at `article.title`, string `article_title`, or `article_title.title`, in that order.
8. Construct its canonical URL as `https://x.com/{username}/status/{id}` and use `created_at` as its publication time.
9. Merge new records with all checked-in records.
10. Deduplicate by canonical URL.
11. Sort by descending publication date, then title, then URL.
12. Write the canonical JSON and regenerate only the marked writings-list section in `index.html`.

If the X token is missing, the command reports that X was skipped and still updates Substack. If one remote source fails, the command reports the failure and keeps the checked-in records for that source. The command fails only when every configured remote source fails or generated data is invalid.

Canonicalization removes URL fragments, query strings from Substack URLs, and trailing slashes from non-root paths. X URLs always use the constructed form above. Convert all dates to UTC before taking `YYYY-MM-DD`. For a duplicate URL, choose the record with the newest date; on a date tie, prefer the newly fetched record, then compare title and author by raw Unicode code point order. The final sort uses descending date, then title and URL by raw code point order. Running the same inputs twice must produce byte-identical files.

The renderer escapes HTML in titles and authors. It permits only `https:` URLs. Generated links keep `target="_blank"` and `rel="noreferrer"`. It replaces only the bytes between `<!-- WRITINGS:START -->` and `<!-- WRITINGS:END -->` inside the existing `data-writing-list`; every byte outside those markers must remain unchanged.

## Scheduled workflow

Add a GitHub Action with daily and manual triggers.

- Run daily at `09:17 UTC` to avoid the busiest start-of-hour period.
- Use the default branch.
- Install dependencies with `pnpm`.
- Run the sync command with `X_API_BEARER_TOKEN` from GitHub Actions secrets.
- Run focused tests and the production build.
- Commit `data/writings.json`, `data/writing-sync-state.json`, and generated `index.html` when any of them changed. A cursor-only change must create a commit so a later run cannot scan past an unrecorded cursor.
- Use the repository action token with `contents: write`.
- Pass `VITE_CONTACT_ENDPOINT` and `VITE_TURNSTILE_SITE_KEY` from GitHub repository variables to this workflow's build.
- When generated site content changed, upload the already built `dist` artifact and run an explicit GitHub Pages deployment job in the same scheduled workflow. Do not depend on the bot-token commit to trigger the existing Pages workflow.

Update the existing Pages workflow to pass the same two repository variables beside `VITE_MIXPANEL_TOKEN`. The site key and endpoint are public configuration, not secrets.

Normal user pushes still use the existing GitHub Pages workflow. The scheduled workflow deploys its own generated site content because a commit made with `GITHUB_TOKEN` does not start another workflow. The scheduled workflow can be delayed by GitHub and can be disabled after 60 days without repository activity; manual dispatch remains available.

## Security and privacy

- Never commit the Slack webhook, X bearer token, or Turnstile secret.
- Never send name, email, or message text to Mixpanel.
- Never log contact content in the Worker or browser.
- Never allow Slack markup in user fields to trigger mentions.
- Never accept normal X posts, replies, reposts, or quote posts as writings.
- Do not store contact submissions in the site, Worker, KV, or repository.

## Verification

Automated tests cover:

- Contact form semantic labels, limits, status region, and terminal styling.
- Client success, failure, double-submit, missing configuration, and cleanup behavior.
- Worker origin, method, content type, field validation, honeypot, Turnstile, Slack escaping, success, and upstream failure paths.
- RSS parsing, X Article filtering, author mapping, URL validation, deduplication, stable sorting, HTML escaping, and retained historical records.
- Scheduled workflow source contract and required secret names.

Final verification runs the complete test suite, TypeScript check, production build, `git diff --check` as the repository's formatting check, and a local browser pass of Session 04.

## One-time external setup

Code can be completed without exposing credentials, but live delivery requires these one-time account actions:

1. Create a Slack incoming webhook for channel `C0BT1GQ4BL1`.
2. Create a Cloudflare Turnstile site for `precursorlabs.org`.
3. Deploy the Worker and add its two secrets.
4. Add the public Worker endpoint and Turnstile site key to the GitHub Pages build configuration.
5. Add an X API bearer token to the repository secrets.

After these values exist, a test contact submission and a manual writings workflow run verify the complete live path.

## Existing worktree preservation

The favicon files and favicon changes already staged in `index.html` belong to separate user work. The deleted `artifacts/precursor-twitter-banner.png` also belongs to separate user work. Implementation must not commit, restore, remove, or overwrite those changes. If selective staging requires a temporary index change, restore the exact original staged state before final handoff. Every implementation commit must contain only the files or exact hunks for this feature.
