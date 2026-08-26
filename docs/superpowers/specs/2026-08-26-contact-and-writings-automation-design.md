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

Local builds without a configured endpoint keep the form visible but return `contact_channel_unavailable` on submit. This makes local visual work safe and prevents accidental messages.

## Contact Worker

The Worker exposes one `POST /contact` endpoint and one `GET /health` endpoint.

For each contact request it:

1. Allows only the configured production origin and explicit local development origins.
2. Rejects non-JSON requests and oversized request bodies.
3. Requires an empty honeypot field.
4. Validates name, email, and message length.
5. Verifies the Turnstile token with Cloudflare.
6. Escapes Slack control characters in user content.
7. Sends one formatted Slack message through an incoming webhook.
8. Returns a small JSON result with the correct CORS headers.

The Slack destination is channel ID `C0BT1GQ4BL1`, selected from the supplied channel URL. The webhook is created for that channel in Slack. The Worker does not store form values and must not log the request body.

Worker secrets:

- `SLACK_WEBHOOK_URL`
- `TURNSTILE_SECRET_KEY`

Worker configuration:

- `ALLOWED_ORIGIN=https://precursorlabs.org`
- `SLACK_CHANNEL_ID=C0BT1GQ4BL1`

Public site build configuration:

- `VITE_CONTACT_ENDPOINT`
- `VITE_TURNSTILE_SITE_KEY`

## Writings source data

Move the canonical writings records into a checked-in JSON file. Each item has:

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
4. If `X_API_BEARER_TOKEN` is present, resolve the configured X accounts and fetch their recent original posts.
5. Accept an X record only when the API response contains an `article` object with a title.
6. Merge new records with all checked-in records.
7. Deduplicate by canonical URL.
8. Sort by descending publication date, then title.
9. Write the canonical JSON and regenerate only the marked writings-list section in `index.html`.

If the X token is missing, the command reports that X was skipped and still updates Substack. If one remote source fails, the command reports the failure and keeps the checked-in records for that source. The command fails only when every configured remote source fails or generated data is invalid.

The renderer escapes HTML in titles and authors. It permits only `https:` URLs. Generated links keep `target="_blank"` and `rel="noreferrer"`.

## Scheduled workflow

Add a GitHub Action with daily and manual triggers.

- Run at `17` minutes past the selected UTC hour to avoid the busiest start-of-hour period.
- Use the default branch.
- Install dependencies with `pnpm`.
- Run the sync command with `X_API_BEARER_TOKEN` from GitHub Actions secrets.
- Run focused tests and the production build.
- Commit the writings JSON and generated `index.html` only when they changed.
- Use the repository action token with `contents: write`.

The existing GitHub Pages workflow deploys the generated commit. The scheduled workflow can be delayed by GitHub and can be disabled after 60 days without repository activity; manual dispatch remains available.

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

Final verification runs the complete test suite, TypeScript check, production build, formatting check, and a local browser pass of Session 04.

## One-time external setup

Code can be completed without exposing credentials, but live delivery requires these one-time account actions:

1. Create a Slack incoming webhook for channel `C0BT1GQ4BL1`.
2. Create a Cloudflare Turnstile site for `precursorlabs.org`.
3. Deploy the Worker and add its two secrets.
4. Add the public Worker endpoint and Turnstile site key to the GitHub Pages build configuration.
5. Add an X API bearer token to the repository secrets.

After these values exist, a test contact submission and a manual writings workflow run verify the complete live path.
