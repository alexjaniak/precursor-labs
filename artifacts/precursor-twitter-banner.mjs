export const LOGICAL_WIDTH = 1500;
export const LOGICAL_HEIGHT = 500;
export const CAPTURE_SCALE = 2;

export const ROW_COUNT = 23;
export const COLUMN_COUNT = 125;

export const FONT_SIZE = 18;
export const LETTER_SPACING = 1;
export const ROW_GAP = 3;

export const PADDING_X = 12;
export const PADDING_Y = 10;

export const CHARACTER_ADVANCE = FONT_SIZE * 0.6 + LETTER_SPACING;
export const ROW_ADVANCE = FONT_SIZE + ROW_GAP;

export const GLYPH_POOL = "$#%:;+=/\\[]{}*~?01<>^!-@&";
export const BANNER_SEED = 0x659f58;

export const ACTIVE_CLUSTERS = [
  { row: 0, start: 94, length: 19 },
  { row: 2, start: 7, length: 14 },
  { row: 7, start: 70, length: 22 },
  { row: 9, start: 112, length: 11 },
  { row: 13, start: 25, length: 18 },
  { row: 17, start: 89, length: 25 },
  { row: 20, start: 3, length: 16 },
  { row: 22, start: 55, length: 13 },
];

export const BRAND_WORDS = [
  { row: 3, start: 17, text: "PRECURSOR" },
  { row: 5, start: 101, text: "PRECURSOR" },
  { row: 10, start: 52, text: "PRECURSOR" },
  { row: 16, start: 9, text: "PRECURSOR" },
  { row: 19, start: 84, text: "PRECURSOR" },
];

export function seedFor(row, column) {
  let value =
    BANNER_SEED ^
    Math.imul(row + 1, 0x9e3779b1) ^
    Math.imul(column + 1, 0x85ebca77);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function glyphAt(row, column) {
  return GLYPH_POOL[seedFor(row, column) % GLYPH_POOL.length];
}

export function buildRowText(row) {
  return Array.from({ length: COLUMN_COUNT }, (_, column) => glyphAt(row, column)).join("");
}

export function buildActiveText(row, start, length) {
  return Array.from({ length }, (_, index) => glyphAt(row + 97, start + index + 193)).join("");
}
