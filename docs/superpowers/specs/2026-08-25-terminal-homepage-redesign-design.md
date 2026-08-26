# Terminal Homepage Redesign

## Purpose

Redesign the Precursor Labs homepage as a single light-mode command transcript. The page must keep the current company copy and credibility links, but present them inside one centered, fixed-height terminal window.

## Goals

- Use the approved IBM Plex Mono visual system.
- Make the terminal transcript the only main visual element.
- Keep the current company, research, backer, and experience content.
- Render all transcript groups on the first paint with no staged reveal. Content below the visible terminal area remains available through internal scrolling.
- Keep the terminal usable on desktop and mobile screens.
- Keep the page semantic, accessible, and usable without JavaScript.

## Non-goals

- Do not add command input or other terminal interaction.
- Do not add a typewriter or staged reveal effect.
- Do not keep dark mode.
- Do not keep the current logo or logo animation.
- Do not show X, LinkedIn, or Substack links in this version.
- Do not add new company copy, sections, or analytics events.

## Visual System

Use these design tokens:

| Purpose | Value |
| --- | --- |
| Font | IBM Plex Mono with a standard monospace fallback |
| Page and terminal background | `#FAFAFA` |
| Primary text | `#171717` |
| Secondary text | `#71716B` |
| Accent | `#659F58` |
| Borders and separators | `#E5E5E3` |
| Hover background | `rgb(0 0 0 / 4%)` |

The design must stay flat and compact. Use square corners and 1px borders. Do not use shadows, gradients, cards, or decorative backgrounds. Green is reserved for the blinking cursor and active or selected state.

Install `@fontsource/ibm-plex-mono` as a bundled project dependency. Include only the normal Latin 400 and 500 weights. The production build must serve its WOFF2 files from the site bundle and must not request a font from Google Fonts or another third-party host. Use `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` as the fallback stack.

## Page Layout

The page uses the same `#FAFAFA` background as the terminal. The terminal is defined by its border and header separator, not by a different fill color.

Default layout rules:

- Center the terminal horizontally and vertically in the viewport.
- Give the page 20px padding on each side.
- Set terminal width to `min(900px, calc(100vw - 40px))`.
- Set terminal height to `clamp(520px, 72svh, 720px)`.

At viewport widths of 600px or less, or viewport heights of 560px or less:

- Set page padding to 12px.
- Set terminal width to `calc(100vw - 24px)`.
- Set terminal height to `calc(100svh - 24px)` with no minimum height.
- Reduce transcript body padding from 24px to 16px without changing the content order.

The terminal is a two-row grid with an auto-sized header and a `minmax(0, 1fr)` body. Only the transcript body uses `overflow-y: auto`. The page itself must not scroll at the tested viewport sizes. These rules also apply when browser zoom reduces the effective CSS viewport.

## Terminal Structure

The terminal has two independent units:

1. A compact header that identifies the mock session.
2. A scrollable transcript body that contains the existing page content.

The header is about 32px high. It shows `PRECURSOR_LABS` on the left and `SESSION 01` on the right. Use 10-11px uppercase text, secondary text color, and a 1px bottom border. Do not use round window controls or traffic-light buttons.

The transcript body uses normal responsive text wrapping. Do not implement the full transcript as a single `<pre>` element because long copy must wrap cleanly on mobile. Use semantic command and output groups that CSS can style as a transcript.

## Transcript Content

Render these command groups in this order. The text and destinations below are the fixed content snapshot approved for this redesign, copied from `index.html` at source commit `01686a1`:

1. `$ precursor about`
   - `Precursor Labs is a research company studying the organizing principles and infrastructure for collective intelligence.`
2. `$ precursor thesis`
   - `We believe the next generation of autonomous systems will need to coordinate with humans and agents, reason in dynamic environments, and allocate resources under uncertainty.`
3. `$ precursor research`
   - `We are engineers, financiers, and company builders focusing on multi-agent systems in dynamic social environments, as well as resource scheduling and memory management for latency-constrained inference serving.`
4. `$ precursor interests`
   - `We are especially interested in partners working on interactive learning, multi-agent RL, KV cache allocation, and scheduling.`
5. `$ precursor backers`
   - [Blockchain Capital](https://www.blockchaincapital.com/)
   - [Reforge](https://reforge.vc/)
   - [Blockchain Builders Fund](https://www.blockchainbuilders.fund/)
   - `and others` as unlinked text
6. `$ precursor experience`
   - [AWS](https://aws.amazon.com/)
   - [Stanford](https://www.stanford.edu/)
   - [Northrop Grumman RL](https://www.northropgrumman.com/)
   - [Duke](https://duke.edu/)
   - [Centerview Partners](https://www.centerviewpartners.com/)
   - [Berkeley](https://www.berkeley.edu/)
   - [Cornell](https://www.cornell.edu/)
   - [Harvard](https://www.harvard.edu/)
7. A final `$` prompt followed by the cursor.

Commands provide the transcript rhythm, so extra ASCII decoration must be restrained. Small hyphen rules or list markers are acceptable when they improve scanning, but they must not create hard-width layouts that break on mobile.

Keep the existing destination URLs for backer and experience entries. Links open in a new tab and retain the current safe `rel` behavior.

## Typography and States

- Use IBM Plex Mono for every visible element.
- Use 13px transcript text with a 1.65 line height at all supported viewport sizes.
- Use 24px transcript body padding by default and 16px under the narrow-or-short media rule.
- Use 24px between command groups and 8px between a command and its output.
- Use tabular numbers for `SESSION 01`.
- Use primary text for commands and output copy.
- Use secondary text for the prompt marker, header metadata, and low-priority terminal text.
- Keep links in the normal text color and identify them with a restrained underline or equivalent non-color cue.
- Use a hover background of `rgb(0 0 0 / 4%)` with a transition of no more than 150ms.
- Use a visible keyboard focus outline that meets contrast requirements.

The scroll bar must be narrow, square, and simple. Its track uses the page color. Its thumb uses the secondary-text color so it remains visible at 4.70:1 contrast without depending on hover. Borders and separators continue to use the separator color.

## Cursor Motion

Show all text at once. The only automatic motion is the block cursor at the final prompt.

- Render the cursor as a solid block in `#659F58`.
- Use a 1-second discrete `step-end` blink, not a fade.
- Mark the cursor as decorative so a screen reader does not announce it.
- Disable the blink for `prefers-reduced-motion: reduce`; leave the cursor visible.

## Semantics and Accessibility

- Use one `<main>` element containing one labelled terminal `<section>`.
- Use a real heading for the terminal label, even if it is visually compact.
- Represent transcript groups with semantic sections, paragraphs, and lists.
- Keep all link names descriptive and keyboard accessible.
- Do not use `role="application"` or simulate a real input. The terminal is a visual presentation of static content.
- Keep reading order identical to visual order.
- Preserve useful page metadata, structured data, icons, robots, sitemap, and canonical URL.

The page content must remain complete and readable if the main script fails. JavaScript is needed only for analytics, not for layout, content, scrolling, or cursor presentation.

## Analytics

Keep local analytics disabled as required by `AGENTS.md`.

Keep these production events:

- `page_viewed`
- `outbound_link_clicked` for backer and experience links

Use this exact retained `outbound_link_clicked` property contract:

- `link_name`: the existing stable snake-case name for the destination
- `link_category`: only `backer` or `experience`
- `is_primary`: always `false` in this version

Remove the old theme toggle and logo animation calls and event types:

- `theme_toggled`
- `logo_animation_started`

Update the tracking plan in `AGENTS.md` in the same change so it matches the implemented event contract. Do not add replacement events.

Remove `social` from the active `link_category` values in the TypeScript event type and tracking plan. The redesigned page has no Initial Value Moment because the current Initial Value Moment is the removed primary Substack link. State this in `AGENTS.md`; do not select a replacement without a separate product decision. Historical Mixpanel data is not changed.

## Implementation Boundaries

The redesign can stay within the existing Vite and TypeScript application.

- `index.html` owns the complete semantic transcript and page metadata.
- `src/styles.css` owns the token system, responsive terminal layout, scrolling, link states, and cursor motion.
- `src/main.ts` keeps only required page-view and outbound-link analytics bindings.
- `src/analytics.ts` keeps only the event types that the redesigned page can send.

Remove logo-animation code and assets from runtime use. Do not delete export scripts or historical design assets unless they cause a build or runtime problem; deleting them is outside this redesign.

## Error Handling

The page has no user input or remote data dependency. Its main failure risks are missing font files and analytics initialization.

- Use a monospace fallback if IBM Plex Mono does not load.
- Keep the existing non-blocking Mixpanel initialization behavior.
- A Mixpanel failure must not change content, layout, links, or scrolling.
- Missing JavaScript must still leave a complete static transcript.

## Verification

Run these checks:

- `pnpm check`
- `pnpm build`

Then verify in a browser:

- Desktop layout near 1440 x 900.
- Mobile layout near 390 x 844.
- Short mobile layout near 390 x 600.
- Short desktop layout near 1024 x 540.
- The terminal stays centered and uses the approved responsive size.
- The transcript starts at the top and scrolls internally to the final prompt.
- All transcript groups are present on first paint even though groups below the visible area require scrolling.
- All current copy appears in the correct command group.
- All backer and experience links have the correct destinations and visible focus states.
- There is no theme toggle, logo, logo animation, or social navigation.
- The cursor is the only automatic motion.
- Reduced-motion mode stops the blink.
- Keyboard-only navigation reaches every link with a visible focus state.
- At 200% browser zoom, content remains readable and the page uses the narrow-or-short rules without horizontal scrolling.
- If the IBM Plex Mono request is blocked, the fallback font renders all content without layout loss.
- With JavaScript disabled on the production build, all transcript content and links remain present and usable.
- No local Mixpanel request is sent during development.
- The production build contains no calls to removed theme or logo events.

## Acceptance Criteria

The redesign is complete when the homepage shows one light-mode, centered terminal transcript that follows the approved color and type system; contains all current body copy and credibility links; scrolls internally at a fixed responsive height; shows no logo, theme control, or social links; and uses a green blinking block cursor as its only automatic motion.
