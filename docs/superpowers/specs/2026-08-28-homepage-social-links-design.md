# Homepage Social Links Update Design

## Goal

Update the homepage terminal `links` row without changing its layout or behavior.

## Change

- Rename the visible `Twitter` label to `X`.
- Keep its destination `https://x.com/precursorlabs` and tracking name `x`.
- Add `Discord` immediately after `X`.
- Link Discord to `https://discord.gg/uBPy5YdRwt`.
- Track Discord as `data-track-link-name="discord"` and `data-track-link-category="social"`.
- Keep the final order `X / Discord / Substack / LinkedIn`.
- Use the existing inline list markup, separator styling, `target="_blank"`, and `rel="noreferrer"`.
- Do not change any other homepage content, styling, interactions, or analytics events.

## Verification

- Add a focused homepage test that requires the exact four-link order, labels, destinations, and analytics attributes.
- Run the focused homepage tests, type check, and production build.
- Commit only the intended source and test changes, then push the final commit to `origin/main`.
