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
- Use IBM Plex Mono 400 at 11px, 1px letter spacing, line-height 1, and a 3px row gap at the final logical scale.
- Keep the webpage field padding of 10px vertically and 12px horizontally. The `#FAFAFA` canvas fills edge to edge, and extra rows and columns clip at its outer edge.
- Use 48 rows and 194 columns so the 11px field keeps the prior right padding without clipping.
- Use the exact glyph pool `$#%:;+=/\\[]{}*~?01<>^!-@&`.
- Build the neutral field with the webpage seed algorithm: `((row + 1) * 1103515245 + (column + 1) * 12345 + row * column * 2654435761) >>> 0`, then select the glyph at `seed % glyphPool.length`.
- Render static symbols in `rgb(113 113 107 / 8%)`.
- Preserve the prior visual placement after the type increase by moving the fixed segment indices to the nearest equivalent pixel positions.
- Render 14 scattered active-scramble clusters in `rgb(101 159 88 / 25%)` at fixed `[row, start, length]` coordinates: `[0,172,17]`, `[2,12,16]`, `[4,141,22]`, `[7,49,12]`, `[10,99,26]`, `[13,22,19]`, `[15,163,18]`, `[21,128,18]`, `[23,4,24]`, `[26,93,16]`, `[28,154,20]`, `[31,40,22]`, `[33,63,21]`, and `[34,110,13]`.
- Generate each active cluster with the same seed algorithm at the offset coordinates `row + 97` and `column + 193`, so its symbols differ from the neutral field but remain deterministic.
- Render five `PRECURSOR` words in `rgb(101 159 88 / 50%)` at fixed `[row, start]` coordinates: `[5,28]`, `[12,146]`, `[18,74]`, `[24,175]`, and `[29,108]`.
- Keep the complete bounds of every `PRECURSOR` word between y=60 and y=440 in the 1500 by 500 logical layout, or y=120 and y=880 in the 2x raster. X can crop about 60 pixels from the top and bottom.
- Keep placement asymmetric and field-like. Do not add a centered title, terminal window, border, shadow, gradient, logo, or decorative background.

## Alternatives

- Centered company name: rejected because it looks like a conventional marketing banner instead of the webpage field.
- Sparse ASCII pattern: rejected because the current webpage uses a dense, continuous texture.
- Generated bitmap artwork: rejected because exact ASCII symbols and exact company-name spelling need deterministic rendering.

## Verification

- A source test confirms the 1500 by 500 logical canvas, 2x capture model, exact typography, glyph pool, seed algorithm, colors, 14 fixed active clusters, and five fixed `PRECURSOR` words.
- A source test calculates every active cluster's horizontal and vertical bounds and confirms all 14 clusters are fully inside the 1500 by 500 logical canvas.
- A source test calculates the complete word bounds and confirms every `PRECURSOR` word stays between y=60 and y=440.
- A browser render waits for `document.fonts.ready`, confirms IBM Plex Mono is active, and confirms the source fills the canvas without scrollbars.
- The final PNG is exactly 1500 by 500 pixels.
- A visual check confirms no `PRECURSOR` word enters the top or bottom crop zones and the pattern matches the webpage background.
