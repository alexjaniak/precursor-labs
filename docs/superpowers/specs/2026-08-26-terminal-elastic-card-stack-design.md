# Terminal Elastic Card Stack Design

## Goal

Turn the current Precursor Labs terminal into the first card in a four-card elastic stack. Use the purchased GSAP Vault Elastic Stack Cards effect as the animation base. Add three placeholder terminal cards now and defer their final content.

## Source and license

- Purchased package: `/Users/dylanvu/Downloads/elastic-stack-cards.zip`
- Product reference: `https://gsapvault.com/effects/elastic-stack-cards`
- Source files reviewed: `README.md`, `START-HERE-AI.md`, `LICENSE.txt`, `index.html`, `assets/script.js`, and `assets/style.css`.
- Preserve the supplied license in the repository as `licenses/elastic-stack-cards-LICENSE.txt`.
- Adapt the purchased spread geometry, resting pile, resize behavior, elastic easing, stagger, and reduced-motion behavior.
- Do not publish or expose the purchased source as a reusable library or template.

## Selected implementation approach

Use a focused TypeScript adapter instead of copying the purchased global script unchanged or rebuilding the effect.

- Add the `gsap` npm package because the project does not have a GSAP installation.
- Keep stack state and responsive geometry in a small pure module.
- Keep GSAP DOM integration and event cleanup in one stack controller.
- Keep stack layout styles separate from the existing terminal visual styles.
- Use stable card IDs for every title-bar and pill selection.
- Do not add ScrollTrigger, Lenis, dragging, swiping, scroll-controlled animation, or new analytics.

The terminal design and the animation remain separate. GSAP can change only card position, rotation, scale, and layer order.

## Card structure and content

The stack contains four semantic `<article>` cards.

Each card has:

1. A real title-bar `<button>` that owns card selection.
2. A separate terminal body that owns its content and scrolling.

The first card keeps the current terminal content without copy or link changes:

- Stable ID: `session-01`
- Title: `PRECURSOR_LABS — zsh`
- Session label: `SESSION 01`

The other three cards are placeholders:

- Stable IDs: `session-02`, `session-03`, and `session-04`
- Title: `PLACEHOLDER — zsh`
- Session labels: `SESSION 02`, `SESSION 03`, and `SESSION 04`
- Body content: `$ content_pending`

The current card is visually frontmost in the initial compact stack. The placeholder content does not define future information architecture.

The title-bar button contains only the window dots, terminal title, and session label. Links, inputs, tables, plots, and other body content must remain outside the button.

## Stack state

The component has one source of truth:

- `isOpen`: whether cards use open geometry.
- `isLocked`: whether the open state persists after hover or focus ends.
- `activeCardId`: selected stable card ID or `null` for overview.
- `layoutMode`: `spread`, `compressed`, or `vertical`.

Initial state:

- `isOpen = false`
- `isLocked = false`
- `activeCardId = null`
- `session-01` is the original top card in the compact pile.

Selecting a card:

- Accept a stable card ID, not a card position.
- Move the matching card above the others.
- Lift and slightly scale the selected card with the purchased elastic motion.
- Set the matching pill button active.
- Selecting the active card changes nothing.
- The selected card remains frontmost if a non-locked hover preview closes.

Selecting `Overview`:

- Clear `activeCardId`.
- Set `isLocked = false` and `isOpen = false`.
- Restore the original compact pile with `session-01` frontmost.
- Return the pill to its initial `Explore` state.

## Explore and pill navigation

The compact state shows one small `Explore` pill below the cards. The full card is not clickable.

The compact trigger and the expanded navigation are separate controls with explicit focus behavior:

- The `Explore` button remains visible during an unlocked preview. It has `aria-expanded="true"` while the cards are previewed and `aria-expanded="false"` while they are resting.
- The expanded `Overview / 01 / 02 / 03 / 04` navigation appears only after `Explore` locks the stack open. It is hidden with the HTML `hidden` state at all other times, so its buttons cannot enter the tab order.
- When pointer hover starts a preview, the pointer can move from `Explore` into the stack without closing it. Clicking the still-visible `Explore` button locks it open.
- When keyboard focus starts a preview, pressing Enter or Space on `Explore` locks it open and moves focus to `Overview`. Moving focus from `Explore` to a card title bar keeps the unlocked preview open.
- When `Overview` resets the stack, focus returns to the newly visible `Explore` button. This prevents focus from falling onto the page body after the expanded navigation is hidden.

Desktop behavior:

- Hovering or focusing the `Explore` control opens a preview.
- Focus or pointer movement between the pill and the card stack does not close the preview.
- Leaving the complete stack-and-navigation region closes the preview unless it is locked.
- Clicking `Explore` locks the stack open.

Touch behavior:

- Tapping `Explore` opens and locks the stack.
- The card body never toggles the stack.

Open pill navigation:

- Expand the pill to `Overview / 01 / 02 / 03 / 04`.
- `Overview` runs the overview action.
- `01–04` select the matching stable card ID.
- The active pill and active card always match.
- Use `aria-current` or `aria-pressed` for the active pill state.

## Card-body isolation

The body is content, not navigation.

- Do not add full-card click or touch handlers.
- Do not call `preventDefault()` at the stack level.
- Do not apply `user-select: none` to the card body.
- Links open normally without selecting or moving a card.
- Text remains selectable.
- Inputs and other controls can receive focus and input without moving or closing a card.
- Only the title-bar button and pill buttons can select cards.

## Animation

Use the purchased `spread` mode.

Preserve these source characteristics:

- Shared centered resting pile.
- `transform-origin: center bottom`.
- Small resting offsets, rotations, and scale steps.
- Elastic open duration and easing based on `elastic.out(0.7, 0.5)`.
- Absolute-distance open stagger.
- Selected-card lift based on the supplied front-card motion.
- Resize measurement and reflow.
- Transform-only animation.

Use the purchased timing values exactly:

- Open: `0.8s` with `elastic.out(0.7, 0.5)`.
- Close: `0.6s` with `elastic.out(0.6, 0.4)`.
- Select/lift: `0.45s` with `elastic.out(0.7, 0.5)`.
- Release the previously selected card: `0.4s` with `power2.out`.
- Spread delay: `Math.abs(u) * 0.09s`, where `u` is the card position normalized from `-1` to `1`.
- Rest delay: `Math.abs(i - mid) * 0.02s`.

The selected card owns its lifted position while the other cards reflow. The active card title bar does nothing when selected again.

## Visual design

- Keep the existing animated ASCII page background unchanged.
- Keep all terminal card surfaces solid `#FAFAFA`.
- Reuse the existing IBM Plex Mono typography, title bar, red/amber/green dots, 1px borders, colors, spacing, and 8px outer radius.
- Keep the current card dimensions: 560px wide and 600–760px tall, with the existing narrow and short viewport sizing rules.
- Use no shadows.
- Use card offsets, scale, rotation, borders, and layer order to show depth.
- Keep the `Explore` and expanded navigation compact, bordered, monospaced, and pill-shaped.
- Use green only for the active pill, selected state indicator, focus state, or existing primary data.
- Keep hover transitions at 150ms or less outside the GSAP card motion.

## Responsive layout

Use the same cards and state model in all layout modes.

### Spread mode

When the available container width supports the purchased travel, use the full supplied spread geometry.

### Compressed mode

When the full spread would overflow:

- Calculate the maximum safe horizontal travel from the current container and card width.
- Reduce the horizontal spread without resizing the cards.
- Keep at least 44px of usable title-bar exposure for selection.
- Preserve the same elastic easing, stagger, rotation direction, and selected-card lift.

### Vertical mode

When the available width cannot keep 44px of title-bar exposure, or the viewport is too short for the fan and controls:

- Stack title bars vertically with at least 44px of exposed control height.
- Use one accordion-like body slot. Expose all four title-bar buttons as separate rows and show one readable card body below the selected title bar.
- When `activeCardId` is `null`, treat `session-01` as the displayed body without changing the overview state. This keeps the original terminal readable in both compact and open layouts.
- When a card is selected, move that stable card into the readable body slot and collapse the other cards to their title-bar rows.
- In compact vertical layout, show `Explore` and the four title bars. In locked-open vertical layout, replace `Explore` with the complete `Overview / 01 / 02 / 03 / 04` navigation. The card-body layout does not depend on hover.
- Allow page scrolling.
- Prevent horizontal page overflow.
- Keep pill navigation available so touch use never depends on hover.

Use measured available space instead of maintaining three separate card implementations. Recompute geometry through one debounced `ResizeObserver` or equivalent resize path.

On a layout-mode change:

- Preserve `activeCardId` and `isLocked`.
- If an unlocked pointer or focus preview is active, close it before applying the new geometry.
- If the stack is locked, keep it open and keep the expanded navigation visible.
- If the stack is not locked, return to the compact control for the destination mode.
- Reapply the destination geometry immediately after measurement, then use the normal motion values for later user actions.

## Accessibility and fallback

- Use semantic `<article>`, `<button>`, and `<nav>` elements.
- Give the stack and navigation useful accessible labels.
- Support Enter and Space through native buttons.
- Use clear `:focus-visible` outlines.
- Keep touch controls at least 44px high.
- Keep focus within the stack-and-navigation region from closing an unlocked preview.
- In reduced-motion mode, do not attach animation or fan listeners. Show all four cards in a readable vertical list.
- With JavaScript disabled or before it loads, show a static compact pile with `session-01` readable at the front.
- If stack initialization cannot complete, leave the static HTML readable and do not hide content.

## Cleanup

The stack controller returns one cleanup function that:

- Removes all pointer, focus, click, and keyboard listeners it added.
- Disconnects its resize observer and clears pending resize work.
- Reverts its GSAP context and active tweens.
- Removes media-query listeners created by the component.

Call cleanup on `pagehide`, matching the existing animated-background lifecycle.

## Testing

### Automated tests

- State tests: initial state, preview open/close, lock, stable-ID selection, active-card no-op, selection persistence, and overview reset.
- Geometry tests: resting pile, full spread, compressed travel, minimum 44px title-bar exposure, vertical fallback, and resize recomputation.
- Timing tests: exact open, close, select, release, spread-delay, and rest-delay values from the purchased source.
- Source tests: four cards, stable IDs, sessions 01–04, placeholder copy, title-bar buttons, separate card bodies, pill labels, license preservation, and no full-card handlers.
- Controller cleanup tests: listener removal, resize-observer disconnect, pending resize cancellation, media-query listener removal, GSAP context reversion, and active-tween termination.
- Existing terminal copy, links, analytics, ASCII animation, and visual-token tests continue to pass.
- TypeScript and production build pass.

### Browser checks

- Mouse: Explore preview, pointer bridge, title-bar selection, card-body isolation, and overview.
- Keyboard: Explore focus, title-bar and pill activation, focus-visible state, and no unexpected close while focus moves inside the region.
- Touch-sized viewport: locked Explore, number selection, vertical fallback, no horizontal overflow, and at least 44px controls.
- Reduced motion: every card is readable in a static vertical layout.
- Card-body behavior: current links open without card movement, text is selectable, and body scrolling works.
- No console errors during open, select, overview, resize, and cleanup paths.

## Out of scope

- Final content for sessions 02–04.
- Dragging or swiping.
- Scroll-controlled stacking.
- ScrollTrigger or Lenis.
- Selecting cards through the body.
- New Mixpanel events.
- Changes to current terminal copy, links, information architecture, or ASCII background behavior.
