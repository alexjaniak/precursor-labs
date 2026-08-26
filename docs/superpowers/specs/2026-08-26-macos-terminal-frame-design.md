# macOS terminal frame design

## Goal

Make the existing light terminal look like a macOS Terminal window and reduce its desktop width. Keep the approved transcript, links, light palette, typeface, scrolling behavior, and analytics unchanged.

## Selected direction

Use a compact macOS-style title bar with three small traffic-light controls on the left, `PRECURSOR_LABS — zsh` centered, and `SESSION 01` on the right. Use subdued control colors so the title bar is recognizable without changing the main accent system.

The window stays flat and square. It has no shadow, gradient, glass effect, or dark theme. The title bar uses a small neutral surface change and the existing 1px separator.

## Structure

- Keep the outer semantic terminal section and the internally scrollable transcript.
- Add one decorative traffic-light group to the existing header. Hide the group from assistive technology because the controls do not perform actions.
- Keep the header title as the terminal label so the section retains its accessible name.
- Do not change transcript copy, outbound links, or tracking attributes.

## Dimensions and responsive behavior

- Reduce the desktop maximum width from 900px to 760px.
- Keep the fixed-height window and internal transcript scroll.
- Use a 36px title bar.
- Keep the existing 12px page inset on narrow or short screens.
- Let the title shrink cleanly on small screens. Hide the session label only when it prevents the title bar from fitting.
- Do not permit horizontal page overflow.

## Visual details

- Title-bar background: a neutral tone close to `#FAFAFA`.
- Control diameter: 10px with 8px gaps.
- Close control: subdued red.
- Minimize control: subdued amber.
- Zoom control: the approved green accent.
- Window border and title-bar separator: `#E5E5E3`.
- Body background, text, cursor, focus, link, and scrollbar styles stay unchanged.

## Accessibility and behavior

- Traffic-light controls are decorative and are not in the keyboard order.
- The transcript remains a named, focusable scroll region.
- Links retain visible focus styles.
- Reduced motion keeps the cursor visible and stops its animation.
- No new JavaScript behavior or analytics event is added.

## Verification

- Add a failing contract test for the three control classes, centered title, 760px width, 36px header, square frame, and no shadow or gradient.
- Run the complete test suite, type check, and production build.
- Check desktop and mobile layouts in a browser.
- Confirm the page has no outer scroll and the terminal body still scrolls internally.
