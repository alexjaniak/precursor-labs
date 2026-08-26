export const LOGICAL_WIDTH = 1500;
export const LOGICAL_HEIGHT = 500;
export const CAPTURE_SCALE = 2;

export const ROW_COUNT = 48;
export const COLUMN_COUNT = 220;

export const FONT_SIZE = 9.5;
export const LETTER_SPACING = 1;
export const ROW_GAP = 3;

export const PADDING_X = 12;
export const PADDING_Y = 10;

export const CHARACTER_ADVANCE = FONT_SIZE * 0.6 + LETTER_SPACING;
export const ROW_ADVANCE = FONT_SIZE + ROW_GAP;

export const GLYPH_POOL = "$#%:;+=/\\[]{}*~?01<>^!-@&";

export const ACTIVE_CLUSTERS = [
  { row: 0, start: 195, length: 17 },
  { row: 2, start: 14, length: 16 },
  { row: 5, start: 160, length: 22 },
  { row: 8, start: 55, length: 12 },
  { row: 11, start: 112, length: 26 },
  { row: 14, start: 25, length: 19 },
  { row: 17, start: 185, length: 18 },
  { row: 23, start: 145, length: 18 },
  { row: 26, start: 5, length: 24 },
  { row: 29, start: 105, length: 16 },
  { row: 32, start: 175, length: 20 },
  { row: 35, start: 45, length: 22 },
  { row: 37, start: 72, length: 21 },
  { row: 38, start: 125, length: 13 },
];

export const BRAND_WORDS = [
  { row: 6, start: 32, text: "PRECURSOR" },
  { row: 13, start: 166, text: "PRECURSOR" },
  { row: 20, start: 84, text: "PRECURSOR" },
  { row: 27, start: 198, text: "PRECURSOR" },
  { row: 33, start: 122, text: "PRECURSOR" },
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
