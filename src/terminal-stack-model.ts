export const CARD_IDS = [
  "session-01",
  "session-02",
  "session-03",
  "session-04",
] as const;

export const MOTION = {
  open: { duration: 0.8, ease: "elastic.out(0.7, 0.5)" },
  close: { duration: 0.6, ease: "elastic.out(0.6, 0.4)" },
  select: { duration: 0.45, ease: "elastic.out(0.7, 0.5)" },
  release: { duration: 0.4, ease: "power2.out" },
} as const;

export const MIN_EXPOSURE = 44;
export const OUTER_GUTTER = 12;
export const MAX_ROTATION_DEGREES = 9;
export const SELECTED_SCALE_INCREASE = 0.05;
export const NONVERTICAL_LAYOUT_GEOMETRY = {
  pageTopPadding: 11,
  fanTopSpace: 123,
  controlGap: 20,
  controlHeight: 44,
} as const;
// GSAP 3.15.0 parseEase("elastic.out(0.7, 0.5)") peaks at 1.1117887536.
// Round upward so sampled open and select motion stays inside the fit bound.
export const ELASTIC_OPEN_MAX_PROGRESS = 1.112;
const SELECTED_LIFT = 26;
const OUTER_REST_X = 4.5;
// Keep the wider rotation envelope for conservative fit calculations; rendered cards stay level.
const OUTER_REST_ROTATION_DEGREES = 2.25;

export type CardId = (typeof CARD_IDS)[number];
export type LayoutMode = "spread" | "compressed" | "vertical";

export type StackState = {
  isOpen: boolean;
  isLocked: boolean;
  activeCardId: CardId | null;
  layoutMode: LayoutMode;
};

export type StackAction =
  | { type: "preview-open" }
  | { type: "preview-close" }
  | { type: "lock-open" }
  | { type: "select"; cardId: CardId }
  | { type: "overview" }
  | { type: "layout"; layoutMode: LayoutMode };

export type CardTransform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
  zIndex: number;
};

type GeometryInput = {
  availableWidth?: number;
  containerWidth: number;
  cardWidth: number;
  cardHeight: number;
  cardCount: number;
};

type SpreadGeometryInput = GeometryInput & {
  compressed: boolean;
};

type LayoutInput = GeometryInput & {
  viewportHeight: number;
};

function getOutwardHorizontalExtent(
  cardWidth: number,
  cardHeight: number,
  rotationDegrees: number,
): number {
  const radians = (rotationDegrees * Math.PI) / 180;
  return (
    (cardWidth / 2) * Math.abs(Math.cos(radians)) +
    cardHeight * Math.abs(Math.sin(radians))
  );
}

function getFitGeometry({
  containerWidth,
  availableWidth = containerWidth,
  cardWidth,
  cardHeight,
  cardCount,
}: GeometryInput) {
  const fanRotation = cardCount > 1 ? MAX_ROTATION_DEGREES : 0;
  const restRotation = cardCount > 1 ? OUTER_REST_ROTATION_DEGREES : 0;
  const restX = cardCount > 1 ? OUTER_REST_X : 0;
  const radians = (fanRotation * Math.PI) / 180;
  const sourceTravel = Math.max(0, (containerWidth - cardWidth) / 2);
  const sourceHalf =
    sourceTravel - Math.min(cardHeight * 0.14, sourceTravel * 0.45);
  const peakAngle =
    restRotation +
    (fanRotation - restRotation) * ELASTIC_OPEN_MAX_PROGRESS;
  const peakOutwardHorizontalExtent = getOutwardHorizontalExtent(
    cardWidth,
    cardHeight,
    peakAngle,
  );
  const leftRestScale = 1 - Math.max(0, cardCount - 1) * 0.015;
  const leftPeakScale =
    leftRestScale +
    (1 - leftRestScale) * ELASTIC_OPEN_MAX_PROGRESS;
  const leftPeakOutwardHorizontalExtent =
    leftPeakScale * peakOutwardHorizontalExtent;
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
          ELASTIC_OPEN_MAX_PROGRESS,
      restX +
        (availableWidth / 2 -
          OUTER_GUTTER -
          peakOutwardHorizontalExtent -
          restX) /
          ELASTIC_OPEN_MAX_PROGRESS,
    ),
  );
  const outerCardCount = Math.max(0, cardCount - 1);
  const requiredHalf = (MIN_EXPOSURE * outerCardCount) / 2;
  const outerOpenY = -5 * outerCardCount;
  const elasticBoundsRequiredViewportHeight =
    upwardVerticalExtent +
    OUTER_GUTTER +
    NONVERTICAL_LAYOUT_GEOMETRY.controlGap +
    NONVERTICAL_LAYOUT_GEOMETRY.controlHeight +
    SELECTED_LIFT -
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
    sourceHalf,
  };
}

export function getSelectedSafeHalf({
  availableWidth,
  cardHeight,
  cardWidth,
}: {
  availableWidth: number;
  cardHeight: number;
  cardWidth: number;
}): number {
  const openOutwardHorizontalExtent = getOutwardHorizontalExtent(
    cardWidth,
    cardHeight,
    MAX_ROTATION_DEGREES,
  );

  return Math.max(
    0,
    availableWidth / 2 -
      OUTER_GUTTER -
      (1 + SELECTED_SCALE_INCREASE) * openOutwardHorizontalExtent,
  );
}

export function createInitialState(): StackState {
  return {
    isOpen: false,
    isLocked: false,
    activeCardId: null,
    layoutMode: "spread",
  };
}

export function reduceStackState(
  state: StackState,
  action: StackAction,
): StackState {
  switch (action.type) {
    case "preview-open":
      if (state.isLocked || state.isOpen) {
        return state;
      }

      return { ...state, isOpen: true };

    case "preview-close":
      if (state.isLocked || !state.isOpen) {
        return state;
      }

      return { ...state, isOpen: false };

    case "lock-open":
      if (state.isLocked && state.isOpen) {
        return state;
      }

      return { ...state, isOpen: true, isLocked: true };

    case "select":
      if (state.activeCardId === action.cardId) {
        return state;
      }

      return { ...state, activeCardId: action.cardId };

    case "overview":
      return {
        isOpen: false,
        isLocked: false,
        activeCardId: null,
        layoutMode: state.layoutMode,
      };

    case "layout":
      return {
        ...state,
        isOpen: state.isLocked,
        layoutMode: action.layoutMode,
      };
  }
}

export function getRestTransforms(cardCount: number): CardTransform[] {
  if (cardCount <= 0) {
    return [];
  }

  const mid = (cardCount - 1) / 2;

  return Array.from({ length: cardCount }, (_, index) => ({
    x: 0,
    y: (cardCount - 1 - index) * 2,
    rotation: 0,
    scale: 1,
    delay: Math.abs(index - mid) * 0.02,
    zIndex: cardCount - index,
  }));
}

export function getSelectedTransform(
  base: CardTransform,
  maxAbsX?: number,
): CardTransform {
  return {
    ...base,
    x:
      maxAbsX === undefined
        ? base.x
        : Math.max(-maxAbsX, Math.min(maxAbsX, base.x)),
    y: base.y - SELECTED_LIFT,
    scale: base.scale + SELECTED_SCALE_INCREASE,
  };
}

export function getSpreadTransforms({
  availableWidth,
  containerWidth,
  cardWidth,
  cardHeight,
  cardCount,
  compressed,
}: SpreadGeometryInput): CardTransform[] {
  if (cardCount <= 0) {
    return [];
  }

  const { openSafeHalf, sourceHalf } = getFitGeometry({
    availableWidth,
    containerWidth,
    cardWidth,
    cardHeight,
    cardCount,
  });
  const half = compressed ? openSafeHalf : sourceHalf;
  const mid = (cardCount - 1) / 2;

  return Array.from({ length: cardCount }, (_, index) => {
    const u = (index - mid) / (mid || 1);

    return {
      x: u * half,
      y: u === 0 ? 0 : -Math.abs(u) * 5 * (cardCount - 1),
      rotation: 0,
      scale: 1,
      delay: Math.abs(u) * 0.09,
      zIndex: index + 1,
    };
  });
}

export function getLayoutMode({
  availableWidth,
  containerWidth,
  viewportHeight,
  cardWidth,
  cardHeight,
  cardCount,
}: LayoutInput): LayoutMode {
  if (cardCount <= 0) {
    return "vertical";
  }

  const measuredAvailableWidth = availableWidth ?? containerWidth;
  const { openSafeHalf, requiredHalf, requiredViewportHeight, sourceHalf } =
    getFitGeometry({
      availableWidth,
      containerWidth,
      cardWidth,
      cardHeight,
      cardCount,
    });

  if (
    viewportHeight < requiredViewportHeight ||
    openSafeHalf < requiredHalf ||
    (cardCount === 1 &&
      measuredAvailableWidth <
        (1 + SELECTED_SCALE_INCREASE) * cardWidth + 2 * OUTER_GUTTER)
  ) {
    return "vertical";
  }

  if (cardCount === 1) {
    return "spread";
  }

  if (openSafeHalf >= sourceHalf) {
    return "spread";
  }

  return "compressed";
}
