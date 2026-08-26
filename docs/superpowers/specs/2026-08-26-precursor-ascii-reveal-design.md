# PRECURSOR ASCII Reveal Design

## Goal

Let the existing Innies-style ASCII animation sometimes resolve into the company name without adding a second animation system.

## Selected behavior

- Reuse the existing animated segments.
- Select every fourth successful segment launch as a company-name reveal.
- Keep ordinary segments unchanged.
- A selected segment scrambles normally, resolves to `PRECURSOR`, holds for 1.5 seconds, and then returns to the random ASCII field.
- Render `PRECURSOR` in the existing accent green at `28%` opacity. Normal animated segments remain at `14%`.
- Keep the terminal surface solid and unchanged.
- Disable all segment motion when the user enables reduced motion.

## Alternatives considered

- One in eight segments: too rare for the name to surface reliably.
- One in four segments: selected because it appears about every 5–7 seconds at the current segment launch rate.
- A separate timed word animation: rejected because it would duplicate the existing scramble system and could create overlapping effects.

## Implementation

Add a launch counter, a brand flag, and a reveal phase to the existing `ActiveSegment` state. Every fourth successful launch creates a brand segment with a fixed nine-character width. It scrambles for 3.5 seconds. A separate reveal timer then sets the text to `PRECURSOR` for 1.5 seconds. When that timer ends, the row receives random glyphs and the segment closes through the current cleanup path. The reveal uses a dedicated `28%` accent class.

## Verification

- A pure timing helper returns the segment phase from its elapsed time. A controlled unit test confirms normal launches, every-fourth brand selection, the 3.5-second scramble phase, the complete 1.5-second reveal phase, and cleanup at five seconds.
- A source test confirms the `PRECURSOR` text and the dedicated `28%` accent style.
- Existing animation, reduced-motion, and solid-terminal tests continue to pass.
- The production build passes.
- A browser check confirms that an existing segment resolves to `PRECURSOR`, uses the approved green opacity, and returns to random glyphs.
