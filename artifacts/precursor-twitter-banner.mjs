export const LOGICAL_WIDTH = 1500;
export const LOGICAL_HEIGHT = 500;
export const CAPTURE_SCALE = 2;

export const ROW_COUNT = 48;
export const COLUMN_COUNT = 148;

export const FONT_SIZE = 15;
export const LETTER_SPACING = 1;
export const ROW_GAP = 3;

export const PADDING_X = 12;
export const PADDING_Y = 10;

export const CHARACTER_ADVANCE = FONT_SIZE * 0.6 + LETTER_SPACING;
export const ROW_ADVANCE = FONT_SIZE + ROW_GAP;

export const GLYPH_POOL = "$#%:;+=/\\[]{}*~?01<>^!-@&";

export const ACTIVE_CLUSTERS = [
  { row: 0, start: 131, length: 17 },
  { row: 2, start: 9, length: 16 },
  { row: 3, start: 107, length: 22 },
  { row: 5, start: 37, length: 12 },
  { row: 8, start: 75, length: 26 },
  { row: 10, start: 17, length: 19 },
  { row: 12, start: 124, length: 18 },
  { row: 16, start: 97, length: 18 },
  { row: 18, start: 3, length: 24 },
  { row: 20, start: 71, length: 16 },
  { row: 23, start: 117, length: 20 },
  { row: 24, start: 30, length: 22 },
  { row: 25, start: 48, length: 21 },
  { row: 26, start: 84, length: 13 },
];

export const BRAND_WORDS = [
  { row: 4, start: 21, text: "PRECURSOR" },
  { row: 9, start: 111, text: "PRECURSOR" },
  { row: 14, start: 56, text: "PRECURSOR" },
  { row: 19, start: 133, text: "PRECURSOR" },
  { row: 22, start: 82, text: "PRECURSOR" },
];

export function seedFor(row, column) {
  return (
    (row + 1) * 1103515245 +
    (column + 1) * 12345 +
    row * column * 2654435761
  ) >>> 0;
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
