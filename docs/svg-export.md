# SVG Export Notes

The active SVG export uses the analytic fillet-pinch construction in
`src/graphics/fillet-pinch.ts`. Logo-specific SVG export helpers live in
`scripts/lib/logo-svg-export.ts` because they are only used by the asset
export scripts.

- each dot is still placed from the same `{ x, y, radius }` data
- connectable pairs get a direct bridge path bounded by two concave fillet arcs
- `all dots` connects every in-range pair
- `custom groups` connects only dots in the same blend group
- `separate dots` fills the circles without bridges

The same renderer is used by the default logo export, the regular banner export, the launch banner export, and the animated glider canvas. The placement and seeded dot-generation code remains separate from the rendering technique.

Closed four-dot cells are not filled as blobs. Grid-based exports rely on the four inward pair fillets around each 2x2 block to carve the negative center shape, matching the VUJA DE-style construction instead of patching a separate center cutout into the shape.

Grid-based exports also cap connection distance to one lattice step. That keeps dot-radius fillets from creating diagonal bridges while preserving the original orthogonal pattern.

Banner exports use deterministic edge dropout (`connectionChance: 0.82`) so adjacent one-step dots do not always connect. Change `--connection-seed=<number>` on `npm run export:banner -- --connection-seed=...` to try different grouping patterns without moving dots.

`npm run export:svg` writes `exports/liquid-dot-logo-default.svg`. `npm run export:svg:transparent` writes `exports/liquid-dot-logo-default-transparent.svg`. Both scripts use the current final square pixel mark defaults:

- `unionMode`: `custom groups`
- `pinchRatio`: `0.8`
- `dotScale`: `1`
- `squareStep`: `0.115`
- `dotRadius`: `squareStep / 2.6`
- `dotColor`: `#fffdfa`
- `backgroundColor`: `#151414`

## Quality

The exported geometry is deterministic and closed-form: circles and bridge shapes built from sampled circular fillet arcs. There is no field sampling, marching-squares resolution, or polyline simplification in the active export path.

The grid ratios are `spacing = 2.6 * r` and `k = 0.8 * r`. Grid exports use one lattice unit for spacing, so their dot radius is `1 / 2.6` and pair fillets use `pinchRatio: 0.8`. The logo keeps its existing saved dot positions, but now follows the same orthogonal-only connection rule as the banner; diagonal links are skipped.

## Merge Back

This implementation touches:

- `src/graphics/fillet-pinch.ts`
- `src/main.ts`
- `scripts/lib/logo-svg-export.ts`
- `scripts/export-default-svg.mts`
- `scripts/export-banner-svg.mts`
- `scripts/export-launch-x-banner.mts`
- `docs/svg-export.md`

Verify with `npm run build`, `npm run export:svg`, `npm run export:svg:transparent`, `npm run export:banner`, `npm run export:banner:transparent`, and `npm run export:launch-banner`.
