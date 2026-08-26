# Active Scramble Color Design

## Goal

Make active ASCII scrambling easier to see without changing the static background field or the company-name reveal.

## Selected design

- Render every active scrambling segment in the accent green `#659F58` at 25% opacity.
- Apply the color to ordinary scrambles and to company-name scrambles during their scramble phase.
- Keep static ASCII symbols at the existing neutral 8% color.
- Keep resolved `PRECURSOR` at 50% green for 1.5 seconds and keep its existing 400 ms fade to neutral.
- Keep scramble timing, frequency, text, motion, and reduced-motion behavior unchanged.

## Alternatives

- Color only company-name scrambles: rejected because the request applies to symbols while they scramble in general.
- Color only the newest changed character: rejected because active segments render as one span and the extra state is not needed.

## Verification

- A source test requires the active segment class to use `rgb(101 159 88 / 25%)`.
- Existing tests continue to protect the neutral static field, 50% `PRECURSOR` reveal, and fade behavior.
- All tests and the production build pass.
- A localhost check confirms an active scramble is 25% green while the row outside it stays neutral.
