# PRECURSOR ASCII Reveal Design

## Goal

Let the existing Innies-style ASCII animation sometimes resolve into the company name without adding a second animation system.

## Selected behavior

- Reuse the existing animated segments.
- Select every fourth successful segment launch as a company-name reveal.
- Keep ordinary scrambles the same neutral color as the static ASCII field.
- A selected segment scrambles normally and resolves to `PRECURSOR`.
- Render `PRECURSOR` in the existing accent green at `40%` opacity for 1.5 seconds.
- After 1.5 seconds, keep `PRECURSOR` in the row and return only its color to the neutral field color.
- Let a later normal scramble change the saved word naturally if its range overlaps the word.
- Keep the terminal surface solid and unchanged.
- Disable all segment motion when the user enables reduced motion.

## Alternatives considered

- One in eight segments: too rare for the name to surface reliably.
- One in four segments: selected because it appears about every 5–7 seconds at the current segment launch rate.
- A separate timed word animation: rejected because it would duplicate the existing scramble system and could create overlapping effects.
- Replacing `PRECURSOR` with random glyphs after the highlight: rejected because the word should persist after its color returns to neutral.
- Leaving `PRECURSOR` green until a later scramble: rejected because the accent should last only 1.5 seconds.

## Implementation

Add a launch counter, a brand flag, and a reveal phase to the existing `ActiveSegment` state. Every fourth successful launch creates a brand segment with a fixed nine-character width. A small cancellable reveal controller uses the existing timeout registry. It allows scrambling for 3.5 seconds, then sets the text to `PRECURSOR` for a complete 1.5-second highlight. When the highlight ends, the row stores `PRECURSOR`, the active span closes, and the static row renders the saved word in the neutral field color. Ordinary active segments inherit the neutral row color. The reveal alone uses a dedicated `40%` accent class. The same cancellation path stops pending work for reduced motion, page visibility changes, and page cleanup.

## Verification

- A fake-scheduler unit test confirms normal launches, every-fourth brand selection, the 3.5-second scramble phase, the complete 1.5-second reveal phase, cancellation, and cleanup at five seconds.
- A source test confirms that normal active segments inherit the neutral color and the reveal uses the dedicated `40%` accent style.
- A regression test confirms that brand completion stores `PRECURSOR` instead of random final text.
- Existing animation, reduced-motion, and solid-terminal tests continue to pass.
- The production build passes.
- A browser check confirms that an existing segment resolves to `PRECURSOR`, uses the approved green opacity, stays in the row after the highlight, and becomes neutral without changing its text.
