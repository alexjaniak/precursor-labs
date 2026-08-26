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
const SELECTED_LIFT = 26;

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

function getOpenOutwardHorizontalExtent(
  cardWidth: number,
  cardHeight: number,
): number {
  const radians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
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
  const radians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
  const sourceTravel = Math.max(0, (containerWidth - cardWidth) / 2);
  const sourceHalf =
    sourceTravel - Math.min(cardHeight * 0.14, sourceTravel * 0.45);
  const openOutwardHorizontalExtent = getOpenOutwardHorizontalExtent(
    cardWidth,
    cardHeight,
  );
  const upwardVerticalExtent =
    (1 + SELECTED_SCALE_INCREASE) *
    (cardHeight * Math.abs(Math.cos(radians)) +
      (cardWidth / 2) * Math.abs(Math.sin(radians)));
  const openSafeHalf = Math.max(
    0,
    availableWidth / 2 - OUTER_GUTTER - openOutwardHorizontalExtent,
  );
  const requiredHalf = (MIN_EXPOSURE * (cardCount - 1)) / 2;
  const outerOpenY = -5 * (cardCount - 1);
  const requiredViewportHeight =
    upwardVerticalExtent +
    2 * OUTER_GUTTER +
    12 +
    44 +
    SELECTED_LIFT -
    outerOpenY;

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
  const openOutwardHorizontalExtent = getOpenOutwardHorizontalExtent(
    cardWidth,
    cardHeight,
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
  const mid = (cardCount - 1) / 2;

  return Array.from({ length: cardCount }, (_, index) => ({
    x: (index - mid) * 3,
    y: (cardCount - 1 - index) * 2,
    rotation: (index - mid) * 1.5,
    scale: 1 - (cardCount - 1 - index) * 0.015,
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
      y: -Math.abs(u) * 5 * (cardCount - 1),
      rotation: u * MAX_ROTATION_DEGREES,
      scale: 1,
      delay: Math.abs(u) * 0.09,
      zIndex: cardCount - index,
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
  const { openSafeHalf, requiredHalf, requiredViewportHeight, sourceHalf } =
    getFitGeometry({
      availableWidth,
      containerWidth,
      cardWidth,
      cardHeight,
      cardCount,
    });

  if (viewportHeight < requiredViewportHeight || openSafeHalf < requiredHalf) {
    return "vertical";
  }

  if (openSafeHalf >= sourceHalf) {
    return "spread";
  }

  return "compressed";
}
