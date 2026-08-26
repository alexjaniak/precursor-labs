import assert from "node:assert/strict";
import test from "node:test";
import gsapModule from "gsap";

const gsap = gsapModule.gsap;

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
const SAFE_ELASTIC_OPEN_MAX_PROGRESS = 1.112;
const NONVERTICAL_LAYOUT_GEOMETRY = {
  pageTopPadding: 11,
  fanTopSpace: 123,
  controlGap: 20,
  controlHeight: 44,
};

function sampleEaseMaximum(easeName, sampleCount = 200000) {
  const ease = gsap.parseEase(easeName);
  let progress = Number.NEGATIVE_INFINITY;
  let time = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const sampleTime = index / sampleCount;
    const sampleProgress = ease(sampleTime);
    if (sampleProgress > progress) {
      progress = sampleProgress;
      time = sampleTime;
    }
  }

  return { progress, time };
}

const sampledOpenEasePeak = sampleEaseMaximum("elastic.out(0.7, 0.5)");

function getFitGeometry({
  containerWidth,
  availableWidth = containerWidth,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
  cardCount = CARD_COUNT,
}) {
  const fanRotation = cardCount > 1 ? MAX_ROTATION_DEGREES : 0;
  const restRotation = cardCount > 1 ? 2.25 : 0;
  const restX = cardCount > 1 ? 4.5 : 0;
  const radians = (fanRotation * Math.PI) / 180;
  const sourceTravel = Math.max(0, (containerWidth - cardWidth) / 2);
  const sourceHalf =
    sourceTravel - Math.min(cardHeight * 0.14, sourceTravel * 0.45);
  const peakAngle =
    restRotation +
    (fanRotation - restRotation) * SAFE_ELASTIC_OPEN_MAX_PROGRESS;
  const peakRadians = (peakAngle * Math.PI) / 180;
  const peakOutwardHorizontalExtent =
    (cardWidth / 2) * Math.abs(Math.cos(peakRadians)) +
    cardHeight * Math.abs(Math.sin(peakRadians));
  const leftPeakScale =
    0.955 + (1 - 0.955) * SAFE_ELASTIC_OPEN_MAX_PROGRESS;
  const leftPeakOutwardHorizontalExtent =
    leftPeakScale * peakOutwardHorizontalExtent;
  const openOutwardHorizontalExtent =
    (cardWidth / 2) * Math.abs(Math.cos(radians)) +
    cardHeight * Math.abs(Math.sin(radians));
  const selectedOutwardHorizontalExtent =
    (1 + SELECTED_SCALE_INCREASE) * openOutwardHorizontalExtent;
  const upwardVerticalExtent =
    (1 + SELECTED_SCALE_INCREASE) *
    (cardHeight * Math.abs(Math.cos(radians)) +
      (cardWidth / 2) * Math.abs(Math.sin(radians)));
  const openSafeHalf = Math.max(
    0,
    Math.min(
      restX +
        (availableWidth / 2 -
          OUTER_GUTTER -
          leftPeakOutwardHorizontalExtent -
          restX) /
          SAFE_ELASTIC_OPEN_MAX_PROGRESS,
      restX +
        (availableWidth / 2 -
          OUTER_GUTTER -
          peakOutwardHorizontalExtent -
          restX) /
          SAFE_ELASTIC_OPEN_MAX_PROGRESS,
    ),
  );
  const selectedSafeHalf = Math.max(
    0,
    availableWidth / 2 - OUTER_GUTTER - selectedOutwardHorizontalExtent,
  );
  const outerCardCount = Math.max(0, cardCount - 1);
  const requiredHalf = (MIN_EXPOSURE * outerCardCount) / 2;
  const outerOpenY = -5 * outerCardCount;
  const elasticBoundsRequiredViewportHeight =
    upwardVerticalExtent +
    OUTER_GUTTER +
    NONVERTICAL_LAYOUT_GEOMETRY.controlGap +
    NONVERTICAL_LAYOUT_GEOMETRY.controlHeight +
    26 -
    outerOpenY;
  const fullLayoutRequiredViewportHeight =
    NONVERTICAL_LAYOUT_GEOMETRY.pageTopPadding +
    cardHeight +
    NONVERTICAL_LAYOUT_GEOMETRY.fanTopSpace +
    NONVERTICAL_LAYOUT_GEOMETRY.controlGap +
    NONVERTICAL_LAYOUT_GEOMETRY.controlHeight;
  const requiredViewportHeight = Math.max(
    elasticBoundsRequiredViewportHeight,
    fullLayoutRequiredViewportHeight,
  );

  return {
    openSafeHalf,
    requiredHalf,
    requiredViewportHeight,
    selectedSafeHalf,
    sourceHalf,
    upwardVerticalExtent,
  };
}

function getBottomCenterBounds(transform, cardWidth, cardHeight) {
  const radians = (transform.rotation * Math.PI) / 180;
  const corners = [
    [-cardWidth / 2, -cardHeight],
    [cardWidth / 2, -cardHeight],
    [-cardWidth / 2, 0],
    [cardWidth / 2, 0],
  ];
  const points = corners.map(([x, y]) => ({
    x:
      transform.x +
      transform.scale * (x * Math.cos(radians) - y * Math.sin(radians)),
    y:
      cardHeight / 2 +
      transform.y +
      transform.scale * (x * Math.sin(radians) + y * Math.cos(radians)),
  }));

  return {
    bottom: Math.max(...points.map(({ y }) => y)),
    left: Math.min(...points.map(({ x }) => x)),
    right: Math.max(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
  };
}

test("exports the stable card IDs and exact motion values", async () => {
  const { CARD_IDS, MOTION, NONVERTICAL_LAYOUT_GEOMETRY: geometry } =
    await loadModel();

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
  assert.deepEqual(geometry, NONVERTICAL_LAYOUT_GEOMETRY);
});

test("exports a safe upper bound for the sampled GSAP open overshoot", async () => {
  const { ELASTIC_OPEN_MAX_PROGRESS } = await loadModel();

  assert.equal(typeof ELASTIC_OPEN_MAX_PROGRESS, "number");
  assert.ok(ELASTIC_OPEN_MAX_PROGRESS >= sampledOpenEasePeak.progress);
  assert.equal(ELASTIC_OPEN_MAX_PROGRESS, SAFE_ELASTIC_OPEN_MAX_PROGRESS);
  assert.ok(Math.abs(sampledOpenEasePeak.progress - 1.1117887536) < 1e-9);
  assert.ok(Math.abs(sampledOpenEasePeak.time - 0.28127) < 1e-5);
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
    { x: -4.5, y: 6, rotation: 0, scale: 0.955, delay: 0.03, zIndex: 4 },
    { x: -1.5, y: 4, rotation: 0, scale: 0.97, delay: 0.01, zIndex: 3 },
    { x: 1.5, y: 2, rotation: 0, scale: 0.985, delay: 0.01, zIndex: 2 },
    { x: 4.5, y: 0, rotation: 0, scale: 1, delay: 0.03, zIndex: 1 },
  ]);
});

test("uses the measured source geometry when full spread is requested", async () => {
  const { getSpreadTransforms } = await loadModel();
  const containerWidth = 1600;
  const { sourceHalf } = getFitGeometry({ containerWidth });
  const input = {
    containerWidth,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
  };

  assert.deepEqual(getSpreadTransforms({ ...input, compressed: false }), [
    { x: -sourceHalf, y: -15, rotation: 0, scale: 1, delay: 0.09, zIndex: 4 },
    { x: (-0.5 / 1.5) * sourceHalf, y: -5, rotation: 0, scale: 1, delay: 0.03, zIndex: 3 },
    { x: (0.5 / 1.5) * sourceHalf, y: -5, rotation: 0, scale: 1, delay: 0.03, zIndex: 2 },
    { x: sourceHalf, y: -15, rotation: 0, scale: 1, delay: 0.09, zIndex: 1 },
  ]);
});

test("compresses the open fan, then clamps selected outer cards inside bottom-center bounds", async () => {
  const {
    getLayoutMode,
    getSelectedSafeHalf,
    getSelectedTransform,
    getSpreadTransforms,
  } =
    await loadModel();
  const containerWidth = 1120;
  const { openSafeHalf, selectedSafeHalf } = getFitGeometry({ containerWidth });
  const input = {
    containerWidth,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    cardCount: CARD_COUNT,
  };
  const transforms = getSpreadTransforms({ ...input, compressed: true });

  assert.equal(typeof getSelectedSafeHalf, "function");
  assert.equal(
    getSelectedSafeHalf({
      availableWidth: containerWidth,
      cardHeight: CARD_HEIGHT,
      cardWidth: CARD_WIDTH,
    }),
    selectedSafeHalf,
  );
  assert.equal(getLayoutMode({ ...input, viewportHeight: 900 }), "compressed");
  assert.equal(transforms[0].x, -openSafeHalf);
  assert.equal(transforms.at(-1).x, openSafeHalf);

  for (let index = 1; index < transforms.length; index += 1) {
    assert.ok(
      transforms[index].x - transforms[index - 1].x >= MIN_EXPOSURE,
      `cards ${index} and ${index + 1} must expose at least ${MIN_EXPOSURE}px`,
    );
  }

  const leftBase = transforms[0];
  const rightBase = transforms.at(-1);
  const originalRightBase = { ...rightBase };
  const selectedLeft = getSelectedTransform(leftBase, selectedSafeHalf);
  const selectedRight = getSelectedTransform(rightBase, selectedSafeHalf);

  assert.deepEqual(selectedRight, {
    x: selectedSafeHalf,
    y: -41,
    rotation: 0,
    scale: 1.05,
    delay: 0.09,
    zIndex: 1,
  });
  assert.notStrictEqual(selectedRight, rightBase);
  assert.deepEqual(rightBase, originalRightBase);

  const leftBounds = getBottomCenterBounds(
    selectedLeft,
    CARD_WIDTH,
    CARD_HEIGHT,
  );
  const rightBounds = getBottomCenterBounds(
    selectedRight,
    CARD_WIDTH,
    CARD_HEIGHT,
  );
  assert.ok(leftBounds.left >= -containerWidth / 2 + OUTER_GUTTER - 1e-9);
  assert.ok(rightBounds.right <= containerWidth / 2 - OUTER_GUTTER + 1e-9);
  assert.ok(Math.abs(leftBounds.left + rightBounds.right) <= 1e-9);
});

test("final-only fan bounds overflow during the sampled elastic open peak", () => {
  const availableWidth = 1280;
  const cardWidth = 560;
  const cardHeight = 702;
  const restX = 4.5;
  const restRotation = 2.25;
  const targetRotation = 9;
  const targetRadians = (targetRotation * Math.PI) / 180;
  const finalOnlySafeHalf =
    availableWidth / 2 -
    OUTER_GUTTER -
    ((cardWidth / 2) * Math.cos(targetRadians) +
      cardHeight * Math.sin(targetRadians));
  const peakCenter =
    restX + (finalOnlySafeHalf - restX) * sampledOpenEasePeak.progress;
  const peakRotation =
    restRotation +
    (targetRotation - restRotation) * sampledOpenEasePeak.progress;
  const peakRadians = (peakRotation * Math.PI) / 180;
  const peakOutwardExtent =
    (cardWidth / 2) * Math.cos(peakRadians) +
    cardHeight * Math.sin(peakRadians);

  assert.ok(peakCenter + peakOutwardExtent > availableWidth / 2 - OUTER_GUTTER);
  assert.ok(-peakCenter - peakOutwardExtent < -availableWidth / 2 + OUTER_GUTTER);
});

test("compressed outer cards stay inside both viewport gutters at elastic peak", async () => {
  const {
    getSelectedSafeHalf,
    getSelectedTransform,
    getSpreadTransforms,
  } = await loadModel();
  const availableWidth = 1280;
  const cardWidth = 560;
  const cardHeight = 702;
  const transforms = getSpreadTransforms({
    availableWidth,
    cardCount: 4,
    cardHeight,
    cardWidth,
    compressed: true,
    containerWidth: 1240,
  });
  const restXs = [-4.5, 4.5];
  const restRotations = [-2.25, 2.25];
  const restScales = [0.955, 1];
  const outerTransforms = [transforms[0], transforms.at(-1)];

  const peakBounds = outerTransforms.map((transform, index) => {
    const center =
      restXs[index] +
      (transform.x - restXs[index]) * sampledOpenEasePeak.progress;
    const rotation =
      restRotations[index] +
      (transform.rotation - restRotations[index]) *
        sampledOpenEasePeak.progress;
    const scale =
      restScales[index] +
      (transform.scale - restScales[index]) *
        sampledOpenEasePeak.progress;
    const radians = (rotation * Math.PI) / 180;
    const outwardExtent =
      scale *
      ((cardWidth / 2) * Math.cos(Math.abs(radians)) +
        cardHeight * Math.sin(Math.abs(radians)));
    return index === 0 ? center - outwardExtent : center + outwardExtent;
  });

  assert.ok(
    peakBounds[0] >= -availableWidth / 2 + OUTER_GUTTER,
    `left gutter is ${peakBounds[0] + availableWidth / 2}px`,
  );
  assert.ok(
    peakBounds[1] <= availableWidth / 2 - OUTER_GUTTER,
    `right gutter is ${availableWidth / 2 - peakBounds[1]}px`,
  );

  const selectedSafeHalf = getSelectedSafeHalf({
    availableWidth,
    cardHeight,
    cardWidth,
  });
  const selected = getSelectedTransform(transforms.at(-1), selectedSafeHalf);
  const targetRadians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
  const selectedPeakScale =
    1 + SELECTED_SCALE_INCREASE * sampledOpenEasePeak.progress;
  const selectedPeakOutwardExtent =
    selectedPeakScale *
    ((cardWidth / 2) * Math.cos(targetRadians) +
      cardHeight * Math.sin(targetRadians));
  assert.equal(selected.x, transforms.at(-1).x);
  assert.ok(
    selected.x + selectedPeakOutwardExtent <=
      availableWidth / 2 - OUTER_GUTTER,
  );
});

test("a wide viewport keeps the full purchased spread", async () => {
  const { getLayoutMode } = await loadModel();

  assert.equal(
    getLayoutMode({
      availableWidth: 1600,
      cardCount: 4,
      cardHeight: 702,
      cardWidth: 560,
      containerWidth: 1440,
      viewportHeight: 1000,
    }),
    "spread",
  );
});

test("chooses exact browser modes from bottom-center selected bounds", async () => {
  const { getLayoutMode } = await loadModel();
  const fourCards = { cardCount: 4, cardWidth: 560 };
  const shortDesktop = {
    ...fourCards,
    availableWidth: 1280,
    cardHeight: 600,
    containerWidth: 1240,
    viewportHeight: 720,
  };
  const shortNarrow = {
    ...fourCards,
    availableWidth: 900,
    cardHeight: 600,
    containerWidth: 860,
    viewportHeight: 720,
  };
  const tallDesktop = {
    ...fourCards,
    availableWidth: 1280,
    cardHeight: 702,
    containerWidth: 1240,
    viewportHeight: 900,
  };
  const shortGeometry = getFitGeometry(shortDesktop);
  const tallGeometry = getFitGeometry(tallDesktop);
  const fullSpread = {
    ...tallDesktop,
    availableWidth: 1600,
    containerWidth: 1440,
    viewportHeight: 1000,
  };

  assert.ok(shortDesktop.viewportHeight < shortGeometry.requiredViewportHeight);
  assert.equal(tallGeometry.requiredViewportHeight, 900);
  assert.ok(tallDesktop.viewportHeight >= tallGeometry.requiredViewportHeight);
  assert.ok(tallGeometry.openSafeHalf < tallGeometry.sourceHalf);
  assert.equal(getLayoutMode(shortDesktop), "vertical");
  assert.equal(getLayoutMode(shortNarrow), "vertical");
  assert.equal(getLayoutMode(fullSpread), "spread");
  assert.equal(getLayoutMode(tallDesktop), "compressed");
});

test("uses vertical mode below the complete nonvertical stack height", async () => {
  const { getLayoutMode } = await loadModel();
  const modeAt = (viewportHeight) =>
    getLayoutMode({
      availableWidth: 1280,
      cardCount: 4,
      cardHeight: Math.min(760, Math.max(600, viewportHeight * 0.78)),
      cardWidth: 560,
      containerWidth: 1240,
      viewportHeight,
    });
  const requiredAt899 =
    NONVERTICAL_LAYOUT_GEOMETRY.pageTopPadding +
    899 * 0.78 +
    NONVERTICAL_LAYOUT_GEOMETRY.fanTopSpace +
    NONVERTICAL_LAYOUT_GEOMETRY.controlGap +
    NONVERTICAL_LAYOUT_GEOMETRY.controlHeight;
  const requiredAt900 =
    NONVERTICAL_LAYOUT_GEOMETRY.pageTopPadding +
    900 * 0.78 +
    NONVERTICAL_LAYOUT_GEOMETRY.fanTopSpace +
    NONVERTICAL_LAYOUT_GEOMETRY.controlGap +
    NONVERTICAL_LAYOUT_GEOMETRY.controlHeight;

  assert.equal(requiredAt899, 899.22);
  assert.equal(requiredAt900, 900);
  assert.equal(modeAt(899), "vertical");
  assert.equal(modeAt(900), "compressed");
});

test("zero and one-card layouts avoid invalid fan geometry", async () => {
  const { getLayoutMode, getRestTransforms, getSpreadTransforms } =
    await loadModel();
  const base = {
    availableWidth: 600,
    cardHeight: 600,
    cardWidth: 560,
    containerWidth: 600,
  };

  assert.deepEqual(getRestTransforms(0), []);
  assert.deepEqual(
    getSpreadTransforms({ ...base, cardCount: 0, compressed: true }),
    [],
  );
  assert.equal(
    getLayoutMode({ ...base, cardCount: 0, viewportHeight: 900 }),
    "vertical",
  );
  assert.equal(
    getLayoutMode({ ...base, cardCount: 1, viewportHeight: 900 }),
    "vertical",
  );
  assert.equal(
    getLayoutMode({
      ...base,
      availableWidth: 620,
      cardCount: 1,
      containerWidth: 620,
      viewportHeight: 900,
    }),
    "spread",
  );
  assert.deepEqual(
    getSpreadTransforms({ ...base, cardCount: 1, compressed: false }),
    [{ x: 0, y: 0, rotation: 0, scale: 1, delay: 0, zIndex: 1 }],
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
