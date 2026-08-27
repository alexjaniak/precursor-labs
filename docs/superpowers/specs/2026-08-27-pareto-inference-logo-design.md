# Pareto Inference Logo Design

## Goal

Create a compact Pareto Inference mark that uses the Precursor Labs palette and stays readable at favicon size.

## Approved mark

- Use a black `#151414` rounded-square field for the primary mark.
- Draw one Pareto frontier in green `#659F58`.
- Fill the dominated region with the same green at 22% opacity.
- Draw the axes in warm white `#FFFDFA`.
- Connect the frontier directly to both axes.
- Inset each visible frontier endpoint by 4 pixels beneath the axis strokes so no green edge extends past the axes.
- Draw the axes above the frontier so the white frame stays continuous.
- Do not include data points, gradients, shadows, labels, or decorative details.

## Transparent version

- Remove the rounded-square field completely.
- Keep the green frontier and shaded region.
- Change the axes to ink `#151414` so they remain visible on a light surface.
- Keep a transparent SVG canvas.

## Deliverables

- `exports/pareto-inference-mark.svg`
- `exports/pareto-inference-mark-transparent.svg`
- `exports/pareto-inference-mark.png`
- `exports/pareto-inference-mark-transparent.png`

## Verification

- Both SVG files use the same approved geometry.
- The transparent SVG has no background rectangle.
- The axes appear after the frontier in SVG source order.
- Both SVG files parse as XML.
- Both PNG previews render at 1024 by 1024 pixels.
