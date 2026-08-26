# Rounded Terminal Design

## Goal

Give the terminal window restrained rounded corners while keeping the compact macOS terminal style.

## Selected design

- Set the outer `.terminal` border radius to 8px.
- Use the existing `overflow: hidden` rule to clip the header and body to the same outer shape.
- Keep borders, colors, spacing, dimensions, internal elements, and all other corners unchanged.
- Do not add shadows or other decoration.

## Alternatives

- 4px: rejected because the curve is difficult to see at the current terminal size.
- 12px: rejected because it makes the compact terminal look too soft.

## Verification

- A source test requires an 8px radius on `.terminal`.
- All existing tests and the production build pass.
- A localhost check confirms the terminal has rounded outer corners with no content overflow.
