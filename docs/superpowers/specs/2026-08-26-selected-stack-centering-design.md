# Selected Stack Centering Design

## Goal

Keep the selected terminal layout vertically centered at every supported laptop viewport height. Measure the visible unit from the top of the highest card to the bottom of the navigation pill.

## Design

- Keep the existing small vertical differences between fanned cards.
- Calculate the selected unit offset from the measured card height and the selected card's fan position.
- Apply the offset to the complete stack region, so the visible space above and below the unit is equal.
- Recalculate the offset after a card selection and after a viewport resize.
- Keep the overview gap at 28px.
- Reduce the selected-card gap between the card stage and navigation pill to 24px.
- Do not change card width, card height, scale, fan order, or animation.

## Implementation Boundary

Put the centering calculation in the stack geometry model. The terminal stack controller will set one CSS custom property on the stack region. CSS will use that property for the selected state and will use 24px for the selected gap.

## Verification

- Check the centering calculation for all four selected cards at several laptop viewport heights.
- Confirm that the selected gap is 24px and the overview gap remains 28px.
- Run the existing stack tests, type check, and production build.
