import {
  BRAND_REVEAL_TEXT,
  isBrandLaunch,
  startBrandRevealTimeline,
} from "./ascii-reveal.ts";

const ASCII_GLYPH_POOL = "$#%:;+=/\\[]{}*~?01<>^!-@&";
const DEFAULT_ROW_COUNT = 72;
const DEFAULT_COLUMN_COUNT = 220;
const MIN_ROW_COUNT = 48;
const MIN_COLUMN_COUNT = 128;
const SAMPLE_GLYPH_COUNT = 48;
const MIN_SEGMENT_LENGTH = 10;
const MAX_SEGMENT_LENGTH = 28;
const ACTIVE_WINDOW_MS = 5000;
const LAUNCH_INTERVAL_MS = 1250;
const MAX_ACTIVE_SEGMENTS = 4;
const GLYPH_TICK_MIN_MS = 90;
const GLYPH_TICK_MAX_MS = 150;

type ActiveSegment = {
  id: number;
  rowIndex: number;
  start: number;
  length: number;
  text: string;
  finalText: string;
  isBrand: boolean;
  isBrandVisible: boolean;
  cancelBrandReveal?: () => void;
};

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomGlyphString(length: number): string {
  return Array.from(
    { length },
    () => ASCII_GLYPH_POOL[randomInt(0, ASCII_GLYPH_POOL.length - 1)],
  ).join("");
}

function seededGlyph(rowIndex: number, columnIndex: number): string {
  const seed = (
    (rowIndex + 1) * 1103515245
    + (columnIndex + 1) * 12345
    + rowIndex * columnIndex * 2654435761
  ) >>> 0;

  return ASCII_GLYPH_POOL[seed % ASCII_GLYPH_POOL.length];
}

function buildSeedGlyphString(length: number, rowIndex: number): string {
  return Array.from({ length }, (_, columnIndex) => seededGlyph(rowIndex, columnIndex)).join("");
}

function buildSeedRows(rowCount: number, columnCount: number): string[] {
  return Array.from(
    { length: rowCount },
    (_, rowIndex) => buildSeedGlyphString(columnCount, rowIndex),
  );
}

function replaceRange(
  input: string,
  start: number,
  length: number,
  replacement: string,
): string {
  return input.slice(0, start) + replacement + input.slice(start + length);
}

function resizeRows(currentRows: string[], rowCount: number, columnCount: number): string[] {
  return Array.from({ length: rowCount }, (_, index) => {
    const currentRow = currentRows[index];

    if (!currentRow) {
      return randomGlyphString(columnCount);
    }

    if (currentRow.length > columnCount) {
      return currentRow.slice(0, columnCount);
    }

    return currentRow + randomGlyphString(columnCount - currentRow.length);
  });
}

export function startAnimatedBackground(field: HTMLElement): () => void {
  let rows = buildSeedRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMN_COUNT);
  let rowElements: HTMLDivElement[] = [];
  let nextSegmentId = 0;
  let successfulLaunchCount = 0;
  let intervalId = 0;
  let syncFrameId = 0;
  const activeSegments = new Map<number, ActiveSegment>();
  const timeoutIds = new Set<number>();
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sampleGlyphs = buildSeedGlyphString(SAMPLE_GLYPH_COUNT, 0);
  const measureRow = document.createElement("div");

  measureRow.className = "ascii-background-row ascii-background-measure-row";
  measureRow.textContent = sampleGlyphs;

  const segmentForRow = (rowIndex: number): ActiveSegment | undefined => (
    [...activeSegments.values()].find((segment) => segment.rowIndex === rowIndex)
  );

  const renderRow = (rowIndex: number) => {
    const rowElement = rowElements[rowIndex];
    const row = rows[rowIndex];

    if (!rowElement || !row) {
      return;
    }

    const segment = segmentForRow(rowIndex);
    if (!segment) {
      rowElement.textContent = row;
      return;
    }

    const activeText = document.createElement("span");
    activeText.className = segment.isBrandVisible
      ? "ascii-background-segment ascii-background-brand"
      : "ascii-background-segment";
    activeText.textContent = segment.text;
    rowElement.replaceChildren(
      document.createTextNode(row.slice(0, segment.start)),
      activeText,
      document.createTextNode(row.slice(segment.start + segment.length)),
    );
  };

  const renderRows = () => {
    const fragment = document.createDocumentFragment();
    rowElements = rows.map((_, rowIndex) => {
      const rowElement = document.createElement("div");
      rowElement.className = "ascii-background-row";
      fragment.append(rowElement);
      return rowElement;
    });

    field.replaceChildren(measureRow, fragment);
    rowElements.forEach((_, rowIndex) => renderRow(rowIndex));
  };

  const syncRowsToField = () => {
    const fieldRect = field.getBoundingClientRect();
    const measureRect = measureRow.getBoundingClientRect();

    if (
      fieldRect.width <= 0
      || fieldRect.height <= 0
      || measureRect.width <= 0
      || measureRect.height <= 0
    ) {
      return;
    }

    const style = window.getComputedStyle(field);
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const gap = Number.parseFloat(style.rowGap || style.gap) || 0;
    const usableWidth = Math.max(0, fieldRect.width - paddingLeft - paddingRight);
    const usableHeight = Math.max(0, fieldRect.height - paddingTop - paddingBottom);
    const glyphWidth = measureRect.width / sampleGlyphs.length;
    const nextColumnCount = Math.max(MIN_COLUMN_COUNT, Math.ceil(usableWidth / glyphWidth) + 4);
    const nextRowCount = Math.max(
      MIN_ROW_COUNT,
      Math.ceil((usableHeight + gap) / (measureRect.height + gap)) + 2,
    );

    if (rows.length === nextRowCount && rows[0]?.length === nextColumnCount) {
      return;
    }

    rows = resizeRows(rows, nextRowCount, nextColumnCount);
    for (const [id, segment] of activeSegments) {
      if (
        segment.rowIndex >= nextRowCount
        || segment.start + segment.length > nextColumnCount
      ) {
        segment.cancelBrandReveal?.();
        activeSegments.delete(id);
      }
    }
    renderRows();
  };

  const queueTimeout = (callback: () => void, delayMs: number): (() => void) => {
    let isPending = true;
    const timeoutId = window.setTimeout(() => {
      isPending = false;
      timeoutIds.delete(timeoutId);
      callback();
    }, delayMs);
    timeoutIds.add(timeoutId);

    return () => {
      if (!isPending) {
        return;
      }

      isPending = false;
      window.clearTimeout(timeoutId);
      timeoutIds.delete(timeoutId);
    };
  };

  const finishSegment = (segment: ActiveSegment) => {
    if (!activeSegments.has(segment.id)) {
      return;
    }

    const row = rows[segment.rowIndex];
    if (row && segment.start + segment.length <= row.length) {
      rows[segment.rowIndex] = replaceRange(
        row,
        segment.start,
        segment.length,
        segment.finalText,
      );
    }
    segment.cancelBrandReveal?.();
    activeSegments.delete(segment.id);
    renderRow(segment.rowIndex);
  };

  const animateSegment = (segment: ActiveSegment) => {
    const endAt = Date.now() + ACTIVE_WINDOW_MS;
    const brandReveal = segment.isBrand
      ? startBrandRevealTimeline(
          queueTimeout,
          (text) => {
            if (!activeSegments.has(segment.id)) {
              return;
            }

            segment.text = text;
            segment.isBrandVisible = true;
            renderRow(segment.rowIndex);
          },
          () => finishSegment(segment),
        )
      : undefined;

    segment.cancelBrandReveal = brandReveal?.cancel;

    const tick = () => {
      if (!activeSegments.has(segment.id)) {
        return;
      }

      if (brandReveal && !brandReveal.shouldScramble()) {
        return;
      }

      if (!brandReveal && Date.now() >= endAt) {
        finishSegment(segment);
        return;
      }

      segment.text = randomGlyphString(segment.length);
      renderRow(segment.rowIndex);
      queueTimeout(tick, randomInt(GLYPH_TICK_MIN_MS, GLYPH_TICK_MAX_MS));
    };

    queueTimeout(tick, randomInt(GLYPH_TICK_MIN_MS, GLYPH_TICK_MAX_MS));
  };

  const launchSegment = () => {
    if (activeSegments.size >= MAX_ACTIVE_SEGMENTS) {
      return;
    }

    const activeRows = new Set([...activeSegments.values()].map((segment) => segment.rowIndex));
    const availableRows = rows
      .map((_, rowIndex) => rowIndex)
      .filter((rowIndex) => !activeRows.has(rowIndex));

    if (availableRows.length === 0) {
      return;
    }

    successfulLaunchCount += 1;
    const isBrand = isBrandLaunch(successfulLaunchCount);
    const rowIndex = availableRows[randomInt(0, availableRows.length - 1)];
    const columnCount = rows[rowIndex]?.length ?? DEFAULT_COLUMN_COUNT;
    const length = isBrand
      ? BRAND_REVEAL_TEXT.length
      : randomInt(MIN_SEGMENT_LENGTH, Math.min(MAX_SEGMENT_LENGTH, columnCount));
    const start = randomInt(0, columnCount - length);
    const currentText = rows[rowIndex].slice(start, start + length);
    let finalText = randomGlyphString(length);

    while (finalText === currentText) {
      finalText = randomGlyphString(length);
    }

    const segment: ActiveSegment = {
      id: nextSegmentId + 1,
      rowIndex,
      start,
      length,
      text: currentText,
      finalText,
      isBrand,
      isBrandVisible: false,
    };
    nextSegmentId = segment.id;
    activeSegments.set(segment.id, segment);
    renderRow(rowIndex);
    animateSegment(segment);
  };

  const stopAnimation = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
    activeSegments.forEach((segment) => segment.cancelBrandReveal?.());
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.clear();
    activeSegments.clear();
    rowElements.forEach((_, rowIndex) => renderRow(rowIndex));
  };

  const startAnimation = () => {
    stopAnimation();
    if (motionPreference.matches || document.hidden) {
      return;
    }

    launchSegment();
    intervalId = window.setInterval(launchSegment, LAUNCH_INTERVAL_MS);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  const resizeObserver = new ResizeObserver(syncRowsToField);
  renderRows();
  resizeObserver.observe(field);
  syncFrameId = window.requestAnimationFrame(syncRowsToField);
  startAnimation();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  motionPreference.addEventListener("change", startAnimation);

  return () => {
    stopAnimation();
    resizeObserver.disconnect();
    window.cancelAnimationFrame(syncFrameId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    motionPreference.removeEventListener("change", startAnimation);
  };
}
