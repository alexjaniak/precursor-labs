# macOS terminal frame design

## Goal

Make the existing light terminal look like a macOS Terminal window and reduce its desktop width. Keep the approved transcript, links, light palette, typeface, scrolling behavior, and analytics unchanged.

## Selected direction

Use a compact macOS-style title bar with three small traffic-light controls on the left, `PRECURSOR_LABS — zsh` centered, and `SESSION 01` on the right. Use subdued control colors so the title bar is recognizable. The red and amber controls are approved, limited additions to the page palette. They are used only for the macOS window controls.

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
- Use a three-column title-bar grid: `1fr auto 1fr`. Align the controls to the start, keep the title in the automatic center column, and align the session label to the end. The two equal flexible columns keep the title at the exact horizontal center of the window even when the side content has different widths.
- Keep the existing 12px page inset on narrow or short screens.
- At 420px and below, hide `SESSION 01` but keep its grid cell so the center title does not move.
- Keep the title on one line. Use overflow clipping with an ellipsis if it cannot fit at the 320px minimum supported viewport.
- Do not permit horizontal page overflow.

## Visual details

- Title-bar background: `#F3F3F1`.
- Control diameter: 10px with 8px gaps.
- Close control: subdued red `#DF6A60`.
- Minimize control: subdued amber `#D9A441`.
- Zoom control: the approved green accent `#659F58`.
- Window border and title-bar separator: `#E5E5E3`.
- Body background, text, cursor, focus, link, and scrollbar styles stay unchanged.

## Accessibility and behavior

- The traffic-light group has `aria-hidden="true"`. It contains only spans. It contains no button, link, form control, `tabindex`, or other keyboard focus target.
- The transcript remains a named, focusable scroll region.
- Links retain visible focus styles.
- Reduced motion keeps the cursor visible and stops its animation.
- No new JavaScript behavior or analytics event is added.

## Verification

- Add a failing contract test for the three control classes, exact control colors, `aria-hidden="true"`, non-interactive markup, centered three-column title layout, 760px width, 36px header, 420px session breakpoint, square frame, and no shadow or gradient.
- Run the complete test suite, type check, and production build.
- Check 1280x720 desktop, 390x844 mobile, 390x600 short mobile, 320x568 minimum mobile, and a 640x360 effective 200% zoom layout in a browser.
- Confirm the title stays centered and the title bar has no overflow at every checked size.
- Confirm the page has no outer scroll and the terminal body still scrolls internally.
