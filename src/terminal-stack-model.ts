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

function getFitGeometry({
  containerWidth,
  cardWidth,
  cardHeight,
  cardCount,
}: GeometryInput) {
  const radians = (MAX_ROTATION_DEGREES * Math.PI) / 180;
  const sourceTravel = Math.max(0, (containerWidth - cardWidth) / 2);
  const sourceHalf =
    sourceTravel - Math.min(cardHeight * 0.14, sourceTravel * 0.45);
  const selectedRotatedHalfWidth =
    (1 + SELECTED_SCALE_INCREASE) *
    (cardWidth * Math.abs(Math.cos(radians)) +
      cardHeight * Math.abs(Math.sin(radians))) /
    2;
  const safeHalf = Math.max(
    0,
    containerWidth / 2 - OUTER_GUTTER - selectedRotatedHalfWidth,
  );
  const requiredHalf = (MIN_EXPOSURE * (cardCount - 1)) / 2;

  return { requiredHalf, safeHalf, sourceHalf };
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

export function getSelectedTransform(base: CardTransform): CardTransform {
  return {
    ...base,
    y: base.y - 26,
    scale: base.scale + SELECTED_SCALE_INCREASE,
  };
}

export function getSpreadTransforms({
  containerWidth,
  cardWidth,
  cardHeight,
  cardCount,
  compressed,
}: SpreadGeometryInput): CardTransform[] {
  const { safeHalf, sourceHalf } = getFitGeometry({
    containerWidth,
    cardWidth,
    cardHeight,
    cardCount,
  });
  const half = compressed ? safeHalf : sourceHalf;
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
  containerWidth,
  viewportHeight,
  cardWidth,
  cardHeight,
  cardCount,
}: LayoutInput): LayoutMode {
  const { requiredHalf, safeHalf, sourceHalf } = getFitGeometry({
    containerWidth,
    cardWidth,
    cardHeight,
    cardCount,
  });

  if (viewportHeight < cardHeight + 120 || safeHalf < requiredHalf) {
    return "vertical";
  }

  if (safeHalf >= sourceHalf) {
    return "spread";
  }

  return "compressed";
}
