# Responsive Terminal Height Design

## Goal

Give the terminal 12px more vertical space on narrow or short screens.

## Selected design

- Keep the existing responsive breakpoint: viewport width of 600px or less, or viewport height of 560px or less.
- Change only the terminal height from `calc(100svh - 24px)` to `calc(100svh - 12px)`.
- Keep the existing page padding, terminal width, body padding, desktop height, scrolling, and all other styles unchanged.

## Alternatives

- Reduce the page padding: rejected because it would also change horizontal spacing.
- Add another viewport rule: rejected because the existing rule already owns this behavior.

## Verification

- A source test requires the exact responsive height value.
- All existing tests and the production build pass.
- A localhost check at a responsive viewport confirms the terminal height is the viewport height minus 12px.
