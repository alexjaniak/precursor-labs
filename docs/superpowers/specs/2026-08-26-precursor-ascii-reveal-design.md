# PRECURSOR ASCII Reveal Design

## Goal

Let the existing Innies-style ASCII animation sometimes resolve into the company name without adding a second animation system.

## Selected behavior

- Reuse the existing animated segments.
- Select one in four new segments as a company-name reveal.
- Keep ordinary segments unchanged.
- A selected segment scrambles normally, resolves to `PRECURSOR`, holds for 1.5 seconds, and then returns to the random ASCII field.
- Render `PRECURSOR` in the existing accent green at a semi-opaque level that is stronger than the normal animated segment color.
- Keep the terminal surface solid and unchanged.
- Disable all segment motion when the user enables reduced motion.

## Alternatives considered

- One in eight segments: too rare for the name to surface reliably.
- One in four segments: selected because it appears about every 5–7 seconds at the current segment launch rate.
- A separate timed word animation: rejected because it would duplicate the existing scramble system and could create overlapping effects.

## Implementation

Add a brand flag and reveal phase to the existing `ActiveSegment` state. Brand segments use a fixed nine-character width. Their normal scramble ticks continue until the final 1.5 seconds of the existing five-second active window. During that hold, the segment text is `PRECURSOR` and it uses a dedicated semi-opaque accent class. At the end, the row receives random glyphs and the segment closes through the current cleanup path.

## Verification

- A source test confirms the one-in-four selection rule, the `PRECURSOR` text, the 1.5-second hold, and the dedicated semi-opaque accent style.
- Existing animation, reduced-motion, and solid-terminal tests continue to pass.
- The production build passes.
- A browser check confirms that an existing segment resolves to `PRECURSOR`, uses the approved green opacity, and returns to random glyphs.
