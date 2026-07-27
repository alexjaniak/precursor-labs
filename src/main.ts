import "./styles.css";
import {
  drawFilletPinchCluster,
  type Dot,
  type FilletPinchParams,
  type Point,
} from "./graphics/fillet-pinch.ts";
import { trackMixpanelEvent } from "./analytics.ts";

type CellState = {
  born: number;
  died: number | null;
};

type Theme = "dark" | "light";

const canvas = requiredElement(
  document.querySelector<HTMLCanvasElement>("#logoAnimation"),
  "logo animation canvas",
);
const context = requiredCanvasContext(canvas);
const siteLogo = requiredElement(
  document.querySelector<HTMLElement>(".site-logo"),
  "site logo",
);
const logoMark = requiredElement(
  document.querySelector<HTMLButtonElement>("#logoMark"),
  "interactive logo mark",
);
const themeToggle = requiredElement(
  document.querySelector<HTMLButtonElement>("#themeToggle"),
  "theme toggle",
);
const themeColorMeta = requiredElement(
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'),
  "theme color meta tag",
);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

function requiredElement<T extends Element>(element: T | null, label: string): T {
  if (!element) throw new Error(`Missing required ${label} element.`);
  return element;
}

function requiredCanvasContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvasElement.getContext("2d");
  if (!canvasContext) throw new Error("Could not initialize 2D canvas context.");
  return canvasContext;
}

const STEP_MS = 680;
const MORPH_MS = 640;
const HOVER_START_DELAY_MS = 90;
const GRID_SIZE = 3;
const CELL_RADIUS = 1 / 2.6;
const blobParams = {
  unionMode: "all dots",
  pinchRatio: 0.8,
  maxConnectionDistance: 1.01,
  dotScale: 1,
} satisfies FilletPinchParams;

// This phase matches the original Figma mark. Each following generation is
// normalized into the fixed 3×3 board so it can return to this resting state.
const gliderSeed: Array<readonly [number, number]> = [
  [0, 0],
  [2, 0],
  [1, 1],
  [2, 1],
  [1, 2],
];

let liveCells = new Set<string>();
let cellStates = new Map<string, CellState>();
let lastStepTime = 0;
let dotColor = "#fffdfa";
let animationFrameId: number | null = null;
let stepsSinceActivation = 0;
let stopRequested = false;
let settleAt: number | null = null;
let pointerHeld = false;
let focusHeld = false;
let pointerInitiatedFocus = false;
let tapStepsRemaining = 0;
let tapPlayback = false;
let colorResetTimer: number | null = null;

function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function refreshThemeColors(): void {
  // The animated cluster is knocked out of the fixed mark, so its color
  // follows the page rather than the surrounding wordmark.
  const paper = themeColor("--paper");
  if (paper) dotColor = paper;
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  themeColorMeta.content = theme === "dark" ? "#151414" : "#fffdfa";
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  refreshThemeColors();
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function resizeCanvas(): void {
  // Supersample the small mark so the liquid edges stay smooth.
  const ratio = Math.min(4, Math.max(window.devicePixelRatio || 1, 2) * 1.5);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function gridPitch(): number {
  return Math.max(9, Math.min(16, canvas.clientWidth * 0.23));
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function parseKey(key: string): [number, number] {
  const [col, row] = key.split(",").map(Number);
  return [col, row];
}

// Keep the native Conway grid orientation inside the fixed 3×3 board.
function gridToWorld(col: number, row: number): Point {
  return {
    x: col + 0.5,
    y: row + 0.5,
  };
}

function seedGlider(time: number, appearInstantly = false): void {
  liveCells = new Set();
  cellStates = new Map();
  const born = appearInstantly ? time - MORPH_MS : time;
  for (const [col, row] of gliderSeed) {
    const key = cellKey(col, row);
    liveCells.add(key);
    cellStates.set(key, { born, died: null });
  }
}

function normalizeToBoard(cells: Set<string>): Set<string> {
  if (!cells.size) return cells;

  const points = [...cells].map(parseKey);
  const minCol = Math.min(...points.map(([col]) => col));
  const minRow = Math.min(...points.map(([, row]) => row));

  return new Set(points.map(([col, row]) => cellKey(col - minCol, row - minRow)));
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

  const nextUnbounded = new Set<string>();
  counts.forEach((neighbors, key) => {
    if (neighbors === 3 || (neighbors === 2 && liveCells.has(key))) nextUnbounded.add(key);
  });
  const next = normalizeToBoard(nextUnbounded);

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

  const originX = (width - GRID_SIZE * pitch) / 2;
  const originY = (height - GRID_SIZE * pitch) / 2;

  drawFilletPinchCluster(context, dots, blobParams, {
    color: dotColor,
    mapPoint: (point) => ({
      x: originX + point.x * pitch,
      y: originY + point.y * pitch,
    }),
  });
}

function interactionHeld(): boolean {
  return pointerHeld || focusHeld;
}

function stopImmediately(time: number): void {
  if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  stopRequested = false;
  settleAt = null;
  stepsSinceActivation = 0;
  tapStepsRemaining = 0;
  siteLogo.classList.remove("is-animating");
  if (tapPlayback) {
    tapPlayback = false;
    logoMark.blur();
  }
  draw(time);
}

function frame(time: number): void {
  if (!stopRequested && time - lastStepTime >= STEP_MS) {
    lastStepTime = time;
    stepLife(time);
    stepsSinceActivation += 1;
    if (tapStepsRemaining > 0) {
      tapStepsRemaining -= 1;
      if (tapStepsRemaining === 0) {
        stopRequested = true;
        settleAt = time + MORPH_MS;
      }
    }
  }
  draw(time);

  if (settleAt != null && time >= settleAt && !interactionHeld()) {
    stopImmediately(time);
    return;
  }

  animationFrameId = requestAnimationFrame(frame);
}

function startAnimation(): void {
  if (colorResetTimer != null) {
    window.clearTimeout(colorResetTimer);
    colorResetTimer = null;
  }
  siteLogo.classList.add("is-animating");
  stopRequested = false;
  settleAt = null;
  if (reduceMotion || animationFrameId != null) return;

  lastStepTime = performance.now() - STEP_MS + HOVER_START_DELAY_MS;
  stepsSinceActivation = 0;
  animationFrameId = requestAnimationFrame(frame);
}

function finishAtCurrentPhase(): void {
  if (reduceMotion) {
    siteLogo.classList.remove("is-animating");
    return;
  }
  if (animationFrameId == null) return;
  if (stepsSinceActivation === 0) {
    stopImmediately(performance.now());
    return;
  }

  stopRequested = true;
  settleAt = Math.max(performance.now(), lastStepTime + MORPH_MS);
}

function playOneGeneration(): void {
  if (reduceMotion) {
    siteLogo.classList.add("is-animating");
    if (colorResetTimer != null) window.clearTimeout(colorResetTimer);
    colorResetTimer = window.setTimeout(() => {
      siteLogo.classList.remove("is-animating");
      logoMark.blur();
      colorResetTimer = null;
    }, 420);
    return;
  }
  if (animationFrameId != null) return;

  tapPlayback = true;
  startAnimation();
  tapStepsRemaining = 1;
}

const storedTheme = localStorage.getItem("theme");
setTheme(storedTheme === "dark" ? "dark" : "light");
resizeCanvas();
seedGlider(performance.now(), true);
draw(performance.now());
trackMixpanelEvent("page_viewed", {
  page_path: window.location.pathname,
  platform: "web",
});

document
  .querySelectorAll<HTMLAnchorElement>("[data-track-link-name]")
  .forEach((link) => {
    link.addEventListener("click", () => {
      const linkName = link.dataset.trackLinkName;
      const linkCategory = link.dataset.trackLinkCategory;
      if (
        !linkName ||
        (linkCategory !== "social" &&
          linkCategory !== "backer" &&
          linkCategory !== "experience")
      ) {
        return;
      }

      trackMixpanelEvent("outbound_link_clicked", {
        link_name: linkName,
        link_category: linkCategory,
        is_primary: link.dataset.trackPrimary === "true",
      });
    });
  });

logoMark.addEventListener("pointerenter", () => {
  if (!canHover.matches) return;
  pointerHeld = true;
  trackMixpanelEvent("logo_animation_started", {
    trigger: "hover",
    theme: currentTheme(),
  });
  startAnimation();
});

logoMark.addEventListener("pointerleave", () => {
  if (!canHover.matches) return;
  pointerHeld = false;
  if (!interactionHeld()) finishAtCurrentPhase();
});

logoMark.addEventListener("pointerdown", () => {
  pointerInitiatedFocus = true;
  window.setTimeout(() => {
    pointerInitiatedFocus = false;
  }, 0);
});

logoMark.addEventListener("focus", () => {
  if (pointerInitiatedFocus) {
    pointerInitiatedFocus = false;
    return;
  }
  if (!logoMark.matches(":focus-visible")) return;
  focusHeld = true;
  trackMixpanelEvent("logo_animation_started", {
    trigger: "keyboard",
    theme: currentTheme(),
  });
  startAnimation();
});

logoMark.addEventListener("blur", () => {
  focusHeld = false;
  if (!interactionHeld()) finishAtCurrentPhase();
});

logoMark.addEventListener("click", () => {
  if (!canHover.matches || focusHeld) return;
  if (!pointerHeld) {
    trackMixpanelEvent("logo_animation_started", {
      trigger: "tap",
      theme: currentTheme(),
    });
    playOneGeneration();
  }
});

if (!canHover.matches) {
  logoMark.disabled = true;
  logoMark.removeAttribute("aria-label");
  logoMark.setAttribute("aria-hidden", "true");
  if (!reduceMotion) startAnimation();
}

themeToggle.addEventListener("click", () => {
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  draw(performance.now());
  trackMixpanelEvent("theme_toggled", { theme: nextTheme });
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw(performance.now());
});

// Re-read theme colors once stylesheets have finished loading.
window.addEventListener("load", () => {
  refreshThemeColors();
  draw(performance.now());
});
