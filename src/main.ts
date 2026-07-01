import "./styles.css";
import {
  drawFilletPinchCluster,
  type Dot,
  type FilletPinchParams,
  type Point,
} from "./graphics/fillet-pinch.ts";

type CellState = {
  born: number;
  died: number | null;
};

type Theme = "dark" | "light";

const canvas = requiredElement(document.querySelector<HTMLCanvasElement>("#glider"), "logo canvas");
const context = requiredCanvasContext(canvas);
const themeToggle = requiredElement(
  document.querySelector<HTMLButtonElement>("#themeToggle"),
  "theme toggle",
);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function requiredElement<T extends Element>(element: T | null, label: string): T {
  if (!element) throw new Error(`Missing required ${label} element.`);
  return element;
}

function requiredCanvasContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvasElement.getContext("2d");
  if (!canvasContext) throw new Error("Could not initialize 2D canvas context.");
  return canvasContext;
}

const SQRT2 = Math.SQRT2;
const STEP_MS = 760;
const MORPH_MS = 640;
const CELL_RADIUS = 1 / 2.6;
const blobParams = {
  unionMode: "all dots",
  pinchRatio: 0.8,
  maxConnectionDistance: 1.01,
  dotScale: 1,
} satisfies FilletPinchParams;

// Glider that drifts one column and one row every four generations; the
// 45 degree lattice rotation turns that diagonal drift into horizontal travel.
const gliderSeed: Array<readonly [number, number]> = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

let liveCells = new Set<string>();
let cellStates = new Map<string, CellState>();
let lastStepTime = 0;
let respawnAt: number | null = null;
let inkColor = "#fffdfa";

function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function refreshThemeColors(): void {
  // Keep the fallback if the stylesheet has not applied yet: an empty custom
  // property would clobber inkColor and leave the canvas at its default black.
  const ink = themeColor("--ink");
  if (ink) inkColor = ink;
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  refreshThemeColors();
}

function resizeCanvas(): void {
  // Supersample above the device ratio: the canvas is tiny, and the extra
  // backing pixels let the browser downscale to noticeably smoother edges.
  const ratio = Math.min(4, Math.max(window.devicePixelRatio || 1, 2) * 1.5);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function gridPitch(): number {
  return Math.max(14, Math.min(21, canvas.clientWidth * 0.034));
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function parseKey(key: string): [number, number] {
  const [col, row] = key.split(",").map(Number);
  return [col, row];
}

// Rotate the lattice 45 degrees: cell centers (col + 0.5, row + 0.5) map to
// world units where +1 col/+1 row in grid space becomes pure +x on screen.
function gridToWorld(col: number, row: number): Point {
  return {
    x: (col + row + 1) / SQRT2,
    y: (row - col) / SQRT2,
  };
}

function seedGlider(time: number, centered = false): void {
  liveCells = new Set();
  cellStates = new Map();
  const targetU = centered ? canvas.clientWidth / gridPitch() / 2 : 2.2;
  const base = Math.round((targetU * SQRT2 - 3) / 2);
  // Centered (reduced-motion) seeds appear instantly; travelling seeds melt in.
  const born = centered ? time - MORPH_MS : time;
  for (const [col, row] of gliderSeed) {
    const key = cellKey(base + col, base + row - 1);
    liveCells.add(key);
    cellStates.set(key, { born, died: null });
  }
}

// Sparse Conway's Game of Life step over the live set.
function stepLife(time: number): void {
  const counts = new Map<string, number>();
  for (const key of liveCells) {
    const [col, row] = parseKey(key);
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (dc === 0 && dr === 0) continue;
        const neighbor = cellKey(col + dc, row + dr);
        counts.set(neighbor, (counts.get(neighbor) ?? 0) + 1);
      }
    }
  }

  const next = new Set<string>();
  counts.forEach((neighbors, key) => {
    if (neighbors === 3 || (neighbors === 2 && liveCells.has(key))) next.add(key);
  });

  next.forEach((key) => {
    const state = cellStates.get(key);
    if (!state) {
      cellStates.set(key, { born: time, died: null });
    } else if (state.died != null) {
      const shrink = Math.min(1, (time - state.died) / MORPH_MS);
      state.born = time - (1 - shrink) * MORPH_MS;
      state.died = null;
    }
  });
  liveCells.forEach((key) => {
    const state = cellStates.get(key);
    if (!next.has(key) && state) state.died = time;
  });

  liveCells = next;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// Live cells become liquid dots; births grow in and deaths melt away.
function currentDots(time: number): Dot[] {
  const dots: Dot[] = [];
  cellStates.forEach((state, key) => {
    let scale = easeOutCubic(Math.min(1, (time - state.born) / MORPH_MS));
    if (state.died != null) {
      const fade = (time - state.died) / MORPH_MS;
      if (fade >= 1) {
        cellStates.delete(key);
        return;
      }
      scale = Math.min(scale, 1 - easeOutCubic(fade));
    }
    // Below this size the dot is sub-pixel and the bridge geometry flickers.
    if (scale <= 0.12) return;
    const [col, row] = parseKey(key);
    const point = gridToWorld(col, row);
    dots.push({ x: point.x, y: point.y, radius: CELL_RADIUS * scale });
  });
  return dots;
}

function draw(time: number): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pitch = gridPitch();

  context.clearRect(0, 0, width, height);

  const dots = currentDots(time);
  if (!dots.length) return;

  drawFilletPinchCluster(context, dots, blobParams, {
    color: inkColor,
    mapPoint: (point) => ({
      x: point.x * pitch,
      y: height / 2 + point.y * pitch,
    }),
  });
}

function maxLiveU(): number {
  let max = -Infinity;
  for (const key of liveCells) {
    const [col, row] = parseKey(key);
    max = Math.max(max, (col + row + 1) / SQRT2);
  }
  return max;
}

// Melt the whole glider away while it is still fully on screen; it grows
// back in at the left edge once the dissolve has finished.
function dissolve(time: number): void {
  liveCells.forEach((key) => {
    const state = cellStates.get(key);
    if (state) state.died = time;
  });
  liveCells = new Set();
  respawnAt = time + MORPH_MS + 220;
}

function frame(time: number): void {
  if (time - lastStepTime >= STEP_MS) {
    lastStepTime = time;
    if (liveCells.size) {
      stepLife(time);
      const limit = canvas.clientWidth / gridPitch() - 1.2;
      if (liveCells.size && maxLiveU() > limit) dissolve(time);
    } else if (respawnAt == null || time >= respawnAt) {
      respawnAt = null;
      seedGlider(time);
    }
  }
  draw(time);
  requestAnimationFrame(frame);
}

const storedTheme = localStorage.getItem("theme");
setTheme(storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark");
resizeCanvas();
seedGlider(performance.now(), reduceMotion);

if (reduceMotion) {
  draw(performance.now());
} else {
  requestAnimationFrame(frame);
}

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  if (reduceMotion) draw(performance.now());
});

window.addEventListener("resize", () => {
  resizeCanvas();
  if (reduceMotion) {
    seedGlider(performance.now(), true);
    draw(performance.now());
  }
});

// Re-read theme colors once stylesheets have finished loading: on mobile
// Safari the custom properties can be unresolved when the module first runs.
window.addEventListener("load", () => {
  refreshThemeColors();
  if (reduceMotion) draw(performance.now());
});
