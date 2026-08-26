# Terminal Homepage Redesign

## Purpose

Redesign the Precursor Labs homepage as a single light-mode command transcript. The page must keep the current company copy and credibility links, but present them inside one centered, fixed-height terminal window.

## Goals

- Use the approved IBM Plex Mono visual system.
- Make the terminal transcript the only main visual element.
- Keep the current company, research, backer, and experience content.
- Show all transcript content immediately.
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

## Page Layout

The page uses the same `#FAFAFA` background as the terminal. The terminal is defined by its border and header separator, not by a different fill color.

On desktop:

- Center the terminal horizontally and vertically in the viewport.
- Limit its width to about 900px with 40px total viewport clearance.
- Use a fixed responsive height near 72% of the small viewport height, with practical minimum and maximum values near 520px and 720px.

On narrow or short screens:

- Use 12px page clearance.
- Let the terminal use most of the small viewport height.
- Reduce terminal body padding without changing the content order.
- Keep all scrolling inside the transcript body unless the viewport cannot contain the terminal safely.

## Terminal Structure

The terminal has two independent units:

1. A compact header that identifies the mock session.
2. A scrollable transcript body that contains the existing page content.

The header is about 32px high. It shows `PRECURSOR_LABS` on the left and `SESSION 01` on the right. Use 10-11px uppercase text, secondary text color, and a 1px bottom border. Do not use round window controls or traffic-light buttons.

The transcript body uses normal responsive text wrapping. Do not implement the full transcript as a single `<pre>` element because long copy must wrap cleanly on mobile. Use semantic command and output groups that CSS can style as a transcript.

## Transcript Content

Render these command groups in this order:

1. `$ precursor about`
   - The current opening company description.
2. `$ precursor thesis`
   - The current statement about the next generation of autonomous systems.
3. `$ precursor research`
   - The current statement about the team and its research areas.
4. `$ precursor interests`
   - The current partner-interest statement.
5. `$ precursor backers`
   - Blockchain Capital
   - Reforge
   - Blockchain Builders Fund
   - and others
6. `$ precursor experience`
   - AWS
   - Stanford
   - Northrop Grumman RL
   - Duke
   - Centerview Partners
   - Berkeley
   - Cornell
   - Harvard
7. A final `$` prompt followed by the cursor.

Use the exact current body copy. Commands provide the transcript rhythm, so extra ASCII decoration must be restrained. Small hyphen rules or list markers are acceptable when they improve scanning, but they must not create hard-width layouts that break on mobile.

Keep the existing destination URLs for backer and experience entries. Links open in a new tab and retain the current safe `rel` behavior.

## Typography and States

- Use IBM Plex Mono for every visible element.
- Use tabular numbers for `SESSION 01`.
- Use primary text for commands and output copy.
- Use secondary text for the prompt marker, header metadata, and low-priority terminal text.
- Keep links in the normal text color and identify them with a restrained underline or equivalent non-color cue.
- Use a hover background of `rgb(0 0 0 / 4%)` with a transition of no more than 150ms.
- Use a visible keyboard focus outline that meets contrast requirements.

The scroll bar must be narrow, square, and simple. Its track uses the page color. Its thumb uses the separator color, with a secondary-text hover state where supported.

## Cursor Motion

Show all text at once. The only automatic motion is the block cursor at the final prompt.

- Render the cursor as a solid block in `#659F58`.
- Use a discrete step blink, not a fade.
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

Remove the old theme toggle and logo animation calls and event types:

- `theme_toggled`
- `logo_animation_started`

Update the tracking plan in `AGENTS.md` in the same change so it matches the implemented event contract. Do not add replacement events.

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
- The terminal stays centered and uses the approved responsive size.
- The transcript starts at the top and scrolls internally to the final prompt.
- All current copy appears in the correct command group.
- All backer and experience links have the correct destinations and visible focus states.
- There is no theme toggle, logo, logo animation, or social navigation.
- The cursor is the only automatic motion.
- Reduced-motion mode stops the blink.
- No local Mixpanel request is sent during development.
- The production build contains no calls to removed theme or logo events.

## Acceptance Criteria

The redesign is complete when the homepage shows one light-mode, centered terminal transcript that follows the approved color and type system; contains all current body copy and credibility links; scrolls internally at a fixed responsive height; shows no logo, theme control, or social links; and uses a green blinking block cursor as its only automatic motion.
