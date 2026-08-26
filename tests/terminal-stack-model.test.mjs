import assert from "node:assert/strict";
import test from "node:test";

const modelModuleUrl = new URL(
  "../src/terminal-stack-model.ts",
  import.meta.url,
);

const loadModel = () => import(modelModuleUrl.href);

const CARD_WIDTH = 760;
const CARD_HEIGHT = 500;
const CARD_COUNT = 4;
const MIN_EXPOSURE = 44;
const OUTER_GUTTER = 12;
const MAX_ROTATION_DEGREES = 9;
const SELECTED_SCALE_INCREASE = 0.05;

function getFitGeometry(containerWidth) {
  const radians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
  const sourceTravel = Math.max(0, (containerWidth - CARD_WIDTH) / 2);
  const sourceHalf =
    sourceTravel - Math.min(CARD_HEIGHT * 0.14, sourceTravel * 0.45);
  const selectedRotatedHalfWidth =
    (1 + SELECTED_SCALE_INCREASE) *
    (CARD_WIDTH * Math.abs(Math.cos(radians)) +
      CARD_HEIGHT * Math.abs(Math.sin(radians))) /
    2;
  const safeHalf = Math.max(
    0,
    containerWidth / 2 - OUTER_GUTTER - selectedRotatedHalfWidth,
  );

  return { selectedRotatedHalfWidth, safeHalf, sourceHalf };
}

test("exports the stable card IDs and exact motion values", async () => {
  const { CARD_IDS, MOTION } = await loadModel();

  assert.deepEqual(CARD_IDS, [
    "session-01",
    "session-02",
    "session-03",
    "session-04",
  ]);
  assert.deepEqual(MOTION, {
    open: { duration: 0.8, ease: "elastic.out(0.7, 0.5)" },
    close: { duration: 0.6, ease: "elastic.out(0.6, 0.4)" },
    select: { duration: 0.45, ease: "elastic.out(0.7, 0.5)" },
    release: { duration: 0.4, ease: "power2.out" },
  });
});

test("creates the closed, unlocked, unselected spread state", async () => {
  const { createInitialState } = await loadModel();

  assert.deepEqual(createInitialState(), {
    isOpen: false,
    isLocked: false,
    activeCardId: null,
    layoutMode: "spread",
  });
});

test("opens and closes an unlocked preview", async () => {
  const { createInitialState, reduceStackState } = await loadModel();
  const initial = createInitialState();
  const open = reduceStackState(initial, { type: "preview-open" });
  const closed = reduceStackState(open, { type: "preview-close" });

  assert.deepEqual(open, { ...initial, isOpen: true });
  assert.deepEqual(closed, initial);
});

test("lock-open keeps the stack open and ignores preview actions", async () => {
  const { createInitialState, reduceStackState } = await loadModel();
  const locked = reduceStackState(createInitialState(), { type: "lock-open" });

  assert.deepEqual(locked, {
    isOpen: true,
    isLocked: true,
    activeCardId: null,
    layoutMode: "spread",
  });
  assert.strictEqual(
    reduceStackState(locked, { type: "preview-open" }),
    locked,
  );
  assert.strictEqual(
    reduceStackState(locked, { type: "preview-close" }),
    locked,
  );
});

test("stable card selection persists after an unlocked preview closes", async () => {
  const { CARD_IDS, createInitialState, reduceStackState } = await loadModel();
  const open = reduceStackState(createInitialState(), { type: "preview-open" });
  const selected = reduceStackState(open, {
    type: "select",
    cardId: CARD_IDS[2],
  });
  const closed = reduceStackState(selected, { type: "preview-close" });

  assert.equal(selected.activeCardId, "session-03");
  assert.deepEqual(closed, {
    ...selected,
    isOpen: false,
  });
});

test("selecting the active card returns the same state object", async () => {
  const { createInitialState, reduceStackState } = await loadModel();
  const selected = reduceStackState(createInitialState(), {
    type: "select",
    cardId: "session-02",
  });

  assert.strictEqual(
    reduceStackState(selected, { type: "select", cardId: "session-02" }),
    selected,
  );
});

test("overview clears interaction state and preserves the layout mode", async () => {
  const { createInitialState, getRestTransforms, reduceStackState } =
    await loadModel();
  let state = reduceStackState(createInitialState(), {
    type: "layout",
    layoutMode: "compressed",
  });
  state = reduceStackState(state, { type: "lock-open" });
  state = reduceStackState(state, {
    type: "select",
    cardId: "session-04",
  });

  const overview = reduceStackState(state, { type: "overview" });
  const restTransforms = getRestTransforms(CARD_COUNT);

  assert.deepEqual(overview, {
    isOpen: false,
    isLocked: false,
    activeCardId: null,
    layoutMode: "compressed",
  });
  assert.equal(restTransforms[0].zIndex, Math.max(...restTransforms.map(({ zIndex }) => zIndex)));
});

test("layout changes preserve selection and lock but close an unlocked preview", async () => {
  const { createInitialState, reduceStackState } = await loadModel();
  let unlocked = reduceStackState(createInitialState(), { type: "preview-open" });
  unlocked = reduceStackState(unlocked, {
    type: "select",
    cardId: "session-01",
  });

  assert.deepEqual(
    reduceStackState(unlocked, { type: "layout", layoutMode: "vertical" }),
    {
      isOpen: false,
      isLocked: false,
      activeCardId: "session-01",
      layoutMode: "vertical",
    },
  );

  let locked = reduceStackState(unlocked, { type: "lock-open" });
  locked = reduceStackState(locked, {
    type: "layout",
    layoutMode: "compressed",
  });

  assert.deepEqual(locked, {
    isOpen: true,
    isLocked: true,
    activeCardId: "session-01",
    layoutMode: "compressed",
  });
});

test("returns the exact four resting transforms with session-01 frontmost", async () => {
  const { getRestTransforms } = await loadModel();

  assert.deepEqual(getRestTransforms(CARD_COUNT), [
    { x: -4.5, y: 6, rotation: -2.25, scale: 0.955, delay: 0.03, zIndex: 4 },
    { x: -1.5, y: 4, rotation: -0.75, scale: 0.97, delay: 0.01, zIndex: 3 },
    { x: 1.5, y: 2, rotation: 0.75, scale: 0.985, delay: 0.01, zIndex: 2 },
    { x: 4.5, y: 0, rotation: 2.25, scale: 1, delay: 0.03, zIndex: 1 },
  ]);
});

test("uses the measured source geometry for a wide spread", async () => {
  const { getLayoutMode, getSpreadTransforms } = await loadModel();
  const containerWidth = 1600;
  const { sourceHalf } = getFitGeometry(containerWidth);
  const input = {
    containerWidth,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
  };

  assert.equal(getLayoutMode({ ...input, viewportHeight: 900 }), "spread");
  assert.deepEqual(getSpreadTransforms({ ...input, compressed: false }), [
    { x: -sourceHalf, y: -15, rotation: -9, scale: 1, delay: 0.09, zIndex: 4 },
    { x: (-0.5 / 1.5) * sourceHalf, y: -5, rotation: -3, scale: 1, delay: 0.03, zIndex: 3 },
    { x: (0.5 / 1.5) * sourceHalf, y: -5, rotation: 3, scale: 1, delay: 0.03, zIndex: 2 },
    { x: sourceHalf, y: -15, rotation: 9, scale: 1, delay: 0.09, zIndex: 1 },
  ]);
});

test("compresses to safe bounds with at least 44px between adjacent centers", async () => {
  const { getLayoutMode, getSelectedTransform, getSpreadTransforms } =
    await loadModel();
  const containerWidth = 1040;
  const { safeHalf, selectedRotatedHalfWidth } = getFitGeometry(containerWidth);
  const input = {
    containerWidth,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
  };
  const transforms = getSpreadTransforms({ ...input, compressed: true });

  assert.equal(getLayoutMode({ ...input, viewportHeight: 900 }), "compressed");
  assert.equal(transforms[0].x, -safeHalf);
  assert.equal(transforms.at(-1).x, safeHalf);

  for (let index = 1; index < transforms.length; index += 1) {
    assert.ok(
      transforms[index].x - transforms[index - 1].x >= MIN_EXPOSURE,
      `cards ${index} and ${index + 1} must expose at least ${MIN_EXPOSURE}px`,
    );
  }

  const base = transforms.at(-1);
  const originalBase = { ...base };
  const selected = getSelectedTransform(base);

  assert.deepEqual(selected, {
    x: safeHalf,
    y: -41,
    rotation: 9,
    scale: 1.05,
    delay: 0.09,
    zIndex: 1,
  });
  assert.notStrictEqual(selected, base);
  assert.deepEqual(base, originalBase);
  assert.ok(
    Math.abs(selected.x) + selectedRotatedHalfWidth <=
      containerWidth / 2 - OUTER_GUTTER + 1e-9,
  );
});

test("uses vertical mode when the container is narrow or the viewport is short", async () => {
  const { getLayoutMode } = await loadModel();
  const base = {
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
  };

  assert.equal(
    getLayoutMode({ ...base, containerWidth: 1000, viewportHeight: 900 }),
    "vertical",
  );
  assert.equal(
    getLayoutMode({ ...base, containerWidth: 1600, viewportHeight: 619 }),
    "vertical",
  );
});

test("returns deterministic spread transforms", async () => {
  const { getSpreadTransforms } = await loadModel();
  const input = {
    containerWidth: 1040,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
    compressed: true,
  };

  assert.deepEqual(getSpreadTransforms(input), getSpreadTransforms(input));
});
