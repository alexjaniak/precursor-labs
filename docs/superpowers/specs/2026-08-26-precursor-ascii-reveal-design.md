# PRECURSOR ASCII Reveal Design

## Goal

Let the existing Innies-style ASCII animation sometimes resolve into the company name without adding a second animation system.

## Selected behavior

- Reuse the existing animated segments.
- Select every fourth successful segment launch as a company-name reveal.
- Keep ordinary scrambles the same neutral color as the static ASCII field.
- A selected segment scrambles normally and resolves to `PRECURSOR`.
- Render `PRECURSOR` in the existing accent green at `50%` opacity for 1.5 seconds.
- After the 1.5-second hold, fade `PRECURSOR` to the neutral field color over 400 ms.
- Keep `PRECURSOR` in the row after the fade completes.
- Let a later normal scramble change the saved word naturally if its range overlaps the word.
- Keep the terminal surface solid and unchanged.
- Disable all segment motion when the user enables reduced motion.

## Alternatives considered

- One in eight segments: too rare for the name to surface reliably.
- One in four segments: selected because it appears about every 5–7 seconds at the current segment launch rate.
- A separate timed word animation: rejected because it would duplicate the existing scramble system and could create overlapping effects.
- Replacing `PRECURSOR` with random glyphs after the highlight: rejected because the word should persist after its color returns to neutral.
- Leaving `PRECURSOR` green until a later scramble: rejected because the accent should last only 1.5 seconds.
- A sudden color change after the hold: rejected because the user asked for a visible fade.
- A CSS transition on the current span: rejected because row rendering replaces the span and would restart or remove the transition. A short keyframe animation gives the replacement span a complete fade.

## Implementation

Add a launch counter, a brand flag, and reveal and fade phases to the existing `ActiveSegment` state. Every fourth successful launch creates a brand segment with a fixed nine-character width. A small cancellable reveal controller uses the existing timeout registry. It allows scrambling for 3.5 seconds, sets the text to `PRECURSOR` for a complete 1.5-second highlight, and then starts a 400 ms fade. When the fade ends, the row stores `PRECURSOR`, the active span closes, and the static row renders the saved word in the neutral field color. Ordinary active segments inherit the neutral row color. The reveal uses a dedicated `50%` accent class. The fade uses a dedicated CSS keyframe from the `50%` accent color to the neutral row color. The same cancellation path stops pending reveal, fade, and completion work for reduced motion, page visibility changes, and page cleanup.

## Verification

- A fake-scheduler unit test confirms normal launches, every-fourth brand selection, the 3.5-second scramble phase, the complete 1.5-second reveal phase, the 400 ms fade phase, cancellation during the fade, and cleanup at 5.4 seconds.
- A source test confirms that normal active segments inherit the neutral color, the reveal uses the dedicated `50%` accent style, and the fade keyframe ends at the neutral row color.
- A regression test confirms that brand completion stores `PRECURSOR` instead of random final text.
- Existing animation, reduced-motion, and solid-terminal tests continue to pass.
- The production build passes.
- A browser check confirms that an existing segment resolves to `PRECURSOR`, uses the approved green opacity, fades after the hold, stays in the row after the fade, and becomes neutral without changing its text.
