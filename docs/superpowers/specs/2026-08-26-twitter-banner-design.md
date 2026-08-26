# Precursor X Banner Design

## Goal

Create a sharp X profile banner that looks like a still frame of the Precursor Labs animated ASCII background.

## Output

- Final format: PNG.
- Use a 1500 by 500 logical layout, the current X-recommended header size.
- Render the logical layout at 2x to a 3000 by 1000 raster, then reduce it to the final 1500 by 500 PNG for clean type edges.
- Wait for IBM Plex Mono to finish loading before capture.
- Save the upload-ready file as `artifacts/precursor-twitter-banner.png`.
- Save the deterministic source as `artifacts/precursor-twitter-banner.html` for later revisions.

## Visual design

- Use the page background `#FAFAFA`.
- Use IBM Plex Mono 400 at 18px, 1px letter spacing, line-height 1, and a 3px row gap at the final logical scale.
- Keep the webpage field padding of 10px vertically and 12px horizontally. The `#FAFAFA` canvas fills edge to edge, and extra rows and columns clip at its outer edge.
- Use 23 rows and 125 columns so the 18px field fills the canvas without clipping.
- Use the exact glyph pool `$#%:;+=/\\[]{}*~?01<>^!-@&`.
- Build the neutral field with a fixed `0x659f58` seed and a mixed two-dimensional integer hash. This keeps the export reproducible without the visible diagonal repetition of the prior arithmetic formula.
- Render static symbols in `rgb(113 113 107 / 8%)`.
- Use irregular fixed placements sampled for this seeded banner instead of evenly spaced rows.
- Render eight scattered active-scramble clusters in `rgb(101 159 88 / 25%)` at fixed `[row, start, length]` coordinates: `[0,94,19]`, `[2,7,14]`, `[7,70,22]`, `[9,112,11]`, `[13,25,18]`, `[17,89,25]`, `[20,3,16]`, and `[22,55,13]`.
- Generate each active cluster with the same seed algorithm at the offset coordinates `row + 97` and `column + 193`, so its symbols differ from the neutral field but remain deterministic.
- Render five `PRECURSOR` words in `rgb(101 159 88 / 50%)` at fixed `[row, start]` coordinates: `[3,17]`, `[5,101]`, `[10,52]`, `[16,9]`, and `[19,84]`.
- Keep the complete bounds of every `PRECURSOR` word between y=60 and y=440 in the 1500 by 500 logical layout, or y=120 and y=880 in the 2x raster. X can crop about 60 pixels from the top and bottom.
- Keep placement asymmetric and field-like. Do not add a centered title, terminal window, border, shadow, gradient, logo, or decorative background.

## Alternatives

- Centered company name: rejected because it looks like a conventional marketing banner instead of the webpage field.
- Sparse ASCII pattern: rejected because the current webpage uses a dense, continuous texture.
- Generated bitmap artwork: rejected because exact ASCII symbols and exact company-name spelling need deterministic rendering.

## Verification

- A source test confirms the 1500 by 500 logical canvas, 2x capture model, exact typography, glyph pool, mixed seed algorithm, colors, eight fixed active clusters, and five fixed `PRECURSOR` words.
- A source test calculates every active cluster's horizontal and vertical bounds and confirms all 14 clusters are fully inside the 1500 by 500 logical canvas.
- A source test calculates the complete word bounds and confirms every `PRECURSOR` word stays between y=60 and y=440.
- A browser render waits for `document.fonts.ready`, confirms IBM Plex Mono is active, and confirms the source fills the canvas without scrollbars.
- The final PNG is exactly 1500 by 500 pixels.
- A visual check confirms no `PRECURSOR` word enters the top or bottom crop zones and the pattern matches the webpage background.
