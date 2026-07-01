import "./styles.css";
import { drawFilletPinchCluster } from "./fillet-pinch.js";

const canvas = document.querySelector("#glider");
const context = canvas.getContext("2d");
const themeToggle = document.querySelector("#themeToggle");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SQRT2 = Math.SQRT2;
const STEP_MS = 760;
const MORPH_MS = 640;
const CELL_RADIUS = 1 / 2.6;
const blobParams = { unionMode: "all dots", pinchRatio: 0.8, maxConnectionDistance: 1.01, dotScale: 1 };

// Glider that drifts one column and one row every four generations; the
// 45 degree lattice rotation turns that diagonal drift into horizontal travel.
const gliderSeed = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

let liveCells = new Set();
let cellStates = new Map();
let lastStepTime = 0;
let respawnAt = null;
let inkColor = "#fffdfa";

function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function refreshThemeColors() {
  // Keep the fallback if the stylesheet has not applied yet: an empty custom
  // property would clobber inkColor and leave the canvas at its default black.
  const ink = themeColor("--ink");
  if (ink) inkColor = ink;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  refreshThemeColors();
}

function resizeCanvas() {
  // Supersample above the device ratio: the canvas is tiny, and the extra
  // backing pixels let the browser downscale to noticeably smoother edges.
  const ratio = Math.min(4, Math.max(window.devicePixelRatio || 1, 2) * 1.5);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function gridPitch() {
  return Math.max(14, Math.min(21, canvas.clientWidth * 0.034));
}

function cellKey(col, row) {
  return `${col},${row}`;
}

function parseKey(key) {
  return key.split(",").map(Number);
}

// Rotate the lattice 45 degrees: cell centers (col + 0.5, row + 0.5) map to
// world units where +1 col/+1 row in grid space becomes pure +x on screen.
function gridToWorld(col, row) {
  return {
    x: (col + row + 1) / SQRT2,
    y: (row - col) / SQRT2,
  };
}

function seedGlider(time, centered = false) {
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
function stepLife(time) {
  const counts = new Map();
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

  const next = new Set();
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
    if (!next.has(key)) cellStates.get(key).died = time;
  });

  liveCells = next;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

// Live cells become liquid dots; births grow in and deaths melt away.
function currentDots(time) {
  const dots = [];
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

function draw(time) {
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

function maxLiveU() {
  let max = -Infinity;
  for (const key of liveCells) {
    const [col, row] = parseKey(key);
    max = Math.max(max, (col + row + 1) / SQRT2);
  }
  return max;
}

// Melt the whole glider away while it is still fully on screen; it grows
// back in at the left edge once the dissolve has finished.
function dissolve(time) {
  liveCells.forEach((key) => {
    cellStates.get(key).died = time;
  });
  liveCells = new Set();
  respawnAt = time + MORPH_MS + 220;
}

function frame(time) {
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

setTheme(localStorage.getItem("theme") || "dark");
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
