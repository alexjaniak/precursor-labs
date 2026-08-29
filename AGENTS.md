# Project Conventions

## Package Manager

Always use `pnpm` instead of `npm` for package management commands.

# Analytics Tracking — Mixpanel

This project uses **Mixpanel** for all product analytics. Mixpanel is the single source of truth for event tracking, user identification, and behavioral data. Do not introduce any other analytics tools, SDKs, or tracking libraries without explicit instruction from a user.

---

## Before You Add or Modify Any Tracking

⛔ **Do not write Mixpanel tracking code without reading this file first.**

Wrong assumptions about platform, identity, or consent will produce broken Mixpanel data that requires manual cleanup or data deletion requests.

### Mandatory checklist before writing any Mixpanel code

- [ ] Confirm you are using the correct Mixpanel SDK for this project's platform (see Tech Stack below)
- [ ] Check if this project routes data through a CDP — if yes, send Mixpanel events through the CDP, not the Mixpanel SDK directly
- [ ] Check if consent gating is required — if this project serves EU or California users, no Mixpanel events may fire before user consent
- [ ] Review the existing Mixpanel tracking plan below before adding new events

---

## Tech Stack

| Detail | Value |
|---|---|
| **Platform** | Vite 5 + TypeScript static website |
| **Mixpanel SDK** | `mixpanel-browser` |
| **SDK version** | `^2.81.0` |
| **Tracking method** | Client-side |
| **CDP (if any)** | None |
| **Consent required** | No, based on the current audience confirmation |
| **Mixpanel project token location** | GitHub Actions secret → `VITE_MIXPANEL_TOKEN` |

Local analytics are intentionally disabled. `pnpm dev` must not initialize Mixpanel or send analytics requests. Production receives `VITE_MIXPANEL_TOKEN` from the deployment environment; never commit an `.env.production` file.
The production token routes to the same Mixpanel project as Pareto Inference; the registered `product` property is the logical data boundary.

---

## Mixpanel Initialization

Mixpanel is initialized in:

**File:** `src/analytics.ts`

```ts
// Mixpanel is initialized lazily, once, after a production-only event is requested.
// Session Replay records 100% of production sessions, including the animated canvas, images, and fonts.
// Public page text is visible in replay; form inputs remain masked and console capture is disabled.
// Autocapture, automatic pageviews, and heatmaps remain disabled. IP-based geolocation is enabled.
// Every event includes shared product, domain, platform, environment, and schema-version super properties.
// Do not create additional Mixpanel instances or import the SDK from feature files.
```

**Do not:**

- Initialize Mixpanel in multiple places
- Create separate Mixpanel instances per component or module
- Import Mixpanel directly in feature files — use `trackMixpanelEvent()` from `src/analytics.ts`
- Enable Mixpanel in local development without an explicit user decision and a separate development project token

---

## Mixpanel Identity

The marketing site currently has no verified account identity. Mixpanel assigns visitors a persistent device ID and enriches activity with IP-derived geolocation. Treat this as the current technical state and connect the device journey to a verified stable identity as soon as one becomes available.

When a verified stable identity becomes available, connect it to the existing device journey:

| Action | When to call | Code location |
|---|---|---|
| `mixpanel.identify(user_id)` | After login, signup, or authenticated session restore | Future authentication handler |
| `mixpanel.reset()` | On every logout path | Future logout handler |

**Rules:**

- Call `mixpanel.identify()` with a stable, internal user ID (database ID or UUID) — never use email addresses as the Mixpanel `distinct_id`
- Call `mixpanel.identify()` only after the user record is confirmed
- Call `mixpanel.reset()` on every logout path
- Never call `mixpanel.identify()` with a different user ID without calling `mixpanel.reset()` first
- Do not fabricate an identity or create a user profile from unverified contact-form input

---

## Mixpanel Tracking Plan

### Naming conventions

- Mixpanel event names: `snake_case`, past-tense verb + noun
- Mixpanel property names: `snake_case`
- No abbreviations in Mixpanel event or property names
- Boolean Mixpanel properties use the `is_` prefix
- Reuse the events below instead of creating one event per link or UI control

### Current Mixpanel events

| Mixpanel Event | Trigger | Key Properties | File |
|---|---|---|---|
| `page_viewed` | The production website loads | `page_path` | `src/main.ts` |
| `outbound_link_clicked` | A tracked backer, experience, social, or project link is opened | `link_name`, `link_category`, sanitized destination, `is_primary` | `src/main.ts`, `index.html` |

The redesigned homepage does not define an Initial Value Moment. The previous Initial Value Moment was the removed primary Substack link. Do not select a replacement without a separate product decision.

### Stable property values

- Shared context: `product: precursor_labs`, `site_domain: precursorlabs.org`, `platform: web`, `environment: production`, `analytics_schema_version: 1`
- `link_category`: `backer`, `experience`, `social`, or `project`
- `is_primary`: always `false` on the redesigned homepage

---

## How to Add a New Mixpanel Event

1. **Check the tracking plan above** — if the Mixpanel event already exists, use it. Do not create duplicate Mixpanel events.
2. **Name the Mixpanel event** using the conventions above: `snake_case`, past tense, descriptive.
3. **Define Mixpanel properties** — only include properties available at the moment the event fires. Do not fetch additional data just for Mixpanel tracking.
4. **Place the Mixpanel tracking call** after the action succeeds.
5. **Update this file** — add the new Mixpanel event to the tracking plan table above.
6. **Verify in Mixpanel Live View** — confirm the event appears with correct properties before considering it done.

### Mixpanel event template

```ts
trackMixpanelEvent("event_name", {
  property_name: value,
});
```

---

## What Not to Do

- **Do not introduce other analytics tools.** This project uses Mixpanel.
- **Do not enable Mixpanel autocapture.** The approved implementation uses a small explicit event contract.
- **Do not add automatic pageview tracking.** The custom `page_viewed` event is the canonical pageview.
- **Do not track sensitive form data as Mixpanel properties** — no emails, full names, phone numbers, payment details, or message contents. IP-based geolocation is enabled; Mixpanel derives location properties and discards the raw IP before ingestion.
- **Do not fire Mixpanel events inside loops** — each event call can produce a network request.
- **Do not hardcode the Mixpanel project token in source code** — read it from Vite environment config.
- **Do not use dynamic event or property names.**
- **Do not use `$` or `mp_` prefixes for custom events or properties.**
