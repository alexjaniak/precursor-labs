import gsap from "gsap";
import {
  CARD_IDS,
  MOTION,
  createInitialState,
  getLayoutMode,
  getRestTransforms,
  getSelectedSafeHalf,
  getSelectedTransform,
  getSelectedUnitCenterOffset,
  getSpreadTransforms,
  reduceStackState,
  type CardId,
  type CardTransform,
  type StackAction,
  type StackState,
} from "./terminal-stack-model.ts";

type StackElement = HTMLElement;

export type TerminalStackElements = {
  stage: StackElement;
  cards: StackElement[];
  titleButtons: StackElement[];
  exploreButton: StackElement;
  overviewButton: StackElement;
  nav: StackElement;
  numberButtons: StackElement[];
};

type StackGsapVars = Record<string, boolean | number | string>;
type StackMotion = (typeof MOTION)[keyof typeof MOTION];

export type TerminalStackGsap = {
  context: (
    callback: () => void,
    scope: Element,
  ) => { revert: () => void };
  set: (target: object, vars: StackGsapVars) => unknown;
  to: (target: object, vars: StackGsapVars) => unknown;
  killTweensOf: (targets: object) => void;
};

export type StackCleanupResources = {
  removeListeners: () => void;
  disconnectObserver: () => void;
  cancelPendingResize: () => void;
  removeMotionListener: () => void;
  revertGsapContext: () => void;
  killActiveTweens: () => void;
};

export type TerminalStackDependencies = {
  elements?: TerminalStackElements;
  gsapApi?: TerminalStackGsap;
  ResizeObserverCtor?: typeof ResizeObserver;
  motionQuery?: MediaQueryList;
  requestFrame?: typeof requestAnimationFrame;
  cancelFrame?: typeof cancelAnimationFrame;
  viewportResizeTarget?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
};

const cleanedResources = new WeakSet<StackCleanupResources>();

export function cleanupStackResources(resources: StackCleanupResources): void {
  if (cleanedResources.has(resources)) {
    return;
  }

  cleanedResources.add(resources);
  resources.removeListeners();
  resources.disconnectObserver();
  resources.cancelPendingResize();
  resources.removeMotionListener();
  resources.killActiveTweens();
  resources.revertGsapContext();
}

function queryStackElements(root: HTMLElement): TerminalStackElements | null {
  const stage = root.querySelector<HTMLElement>("[data-stack-stage]");
  const exploreButton = root.querySelector<HTMLElement>("[data-stack-explore]");
  const overviewButton = root.querySelector<HTMLElement>("[data-stack-overview]");
  const nav = root.querySelector<HTMLElement>("[data-stack-nav]");
  const cards = [...root.querySelectorAll<HTMLElement>("article[data-card-id]")];
  const titleButtons = stage
    ? [...stage.querySelectorAll<HTMLElement>("button[data-card-select]")]
    : [];
  const numberButtons = nav
    ? [...nav.querySelectorAll<HTMLElement>("button[data-card-select]")]
    : [];

  if (!stage || !exploreButton || !overviewButton || !nav) {
    return null;
  }

  return {
    cards,
    exploreButton,
    nav,
    numberButtons,
    overviewButton,
    stage,
    titleButtons,
  };
}

function getCardId(element: StackElement, attribute: "cardId" | "cardSelect") {
  const attributeName = attribute === "cardId" ? "data-card-id" : "data-card-select";
  return element.dataset[attribute] ?? element.getAttribute(attributeName);
}

function hasStableIds(elements: TerminalStackElements): boolean {
  if (
    elements.cards.length !== CARD_IDS.length ||
    elements.titleButtons.length !== CARD_IDS.length ||
    elements.numberButtons.length !== CARD_IDS.length
  ) {
    return false;
  }

  return CARD_IDS.every(
    (cardId, index) =>
      getCardId(elements.cards[index], "cardId") === cardId &&
      getCardId(elements.titleButtons[index], "cardSelect") === cardId &&
      getCardId(elements.numberButtons[index], "cardSelect") === cardId,
  );
}

function clearCardMotion(cards: StackElement[]) {
  for (const card of cards) {
    card.style.removeProperty("transform");
    card.style.removeProperty("z-index");
  }
}

function getDefaultMotionQuery(root: HTMLElement): MediaQueryList {
  const view = root.ownerDocument?.defaultView;

  if (view && typeof view.matchMedia === "function") {
    return view.matchMedia("(prefers-reduced-motion: reduce)");
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  return {
    addEventListener: () => {},
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
}

function getViewportHeight(root: HTMLElement, cardHeight: number): number {
  const view = root.ownerDocument?.defaultView;
  return view?.visualViewport?.height ?? view?.innerHeight ??
    (typeof window === "undefined" ? cardHeight + 200 : window.innerHeight);
}

function getViewportWidth(root: HTMLElement, containerWidth: number): number {
  const view = root.ownerDocument?.defaultView;
  return view?.visualViewport?.width ?? view?.innerWidth ??
    (typeof window === "undefined" ? containerWidth : window.innerWidth);
}

function getDefaultRequestFrame(): typeof requestAnimationFrame {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame.bind(globalThis);
  }

  return ((callback: FrameRequestCallback) =>
    globalThis.setTimeout(() => callback(Date.now()), 16)) as unknown as
    typeof requestAnimationFrame;
}

function getDefaultCancelFrame(): typeof cancelAnimationFrame {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    return globalThis.cancelAnimationFrame.bind(globalThis);
  }

  return ((handle: number) => globalThis.clearTimeout(handle)) as
    typeof cancelAnimationFrame;
}

function getDefaultViewportResizeTarget(root: HTMLElement) {
  const view = root.ownerDocument?.defaultView;

  if (view?.visualViewport) {
    return view.visualViewport;
  }

  if (view) {
    return view;
  }

  return typeof window === "undefined" ? null : window;
}

function createTransformVars(
  transform: CardTransform,
  zIndex = transform.zIndex,
): StackGsapVars {
  return {
    rotation: transform.rotation,
    scale: transform.scale,
    x: transform.x,
    xPercent: -50,
    y: transform.y,
    yPercent: -50,
    zIndex,
  };
}

export function startTerminalStack(
  root: HTMLElement,
  dependencies: TerminalStackDependencies = {},
): () => void {
  const elements = dependencies.elements ?? queryStackElements(root);

  if (!elements || !hasStableIds(elements)) {
    return () => {};
  }

  const {
    cards,
    exploreButton,
    nav,
    numberButtons,
    overviewButton,
    stage,
    titleButtons,
  } = elements;
  const gsapApi = (dependencies.gsapApi ?? gsap) as unknown as TerminalStackGsap;
  const motionQuery = dependencies.motionQuery ?? getDefaultMotionQuery(root);
  const requestFrame = dependencies.requestFrame ?? getDefaultRequestFrame();
  const cancelFrame = dependencies.cancelFrame ?? getDefaultCancelFrame();
  const ResizeObserverCtor =
    dependencies.ResizeObserverCtor ?? globalThis.ResizeObserver;
  const viewportResizeTarget =
    dependencies.viewportResizeTarget ?? getDefaultViewportResizeTarget(root);
  const interactionCleanups: Array<() => void> = [];
  let state: StackState = createInitialState();
  let isCleaned = false;
  let interactionsInstalled = false;
  let isReducedMotion = motionQuery.matches;
  let suppressExploreFocusPreview = false;
  let pendingResize: number | null = null;
  let measuredCardHeight: number | undefined;
  let restTransforms = getRestTransforms(cards.length);
  let selectedSafeHalf: number | undefined;
  let spreadTransforms = restTransforms;

  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    interactionCleanups.push(() =>
      target.removeEventListener(type, handler as EventListener),
    );
  };

  const removeInteractionListeners = () => {
    while (interactionCleanups.length > 0) {
      interactionCleanups.pop()?.();
    }
    exploreButton.removeAttribute("data-pointer-hovered");
    overviewButton.removeAttribute("data-suppress-focus-ring");
    interactionsInstalled = false;
  };

  const syncActiveCenterOffset = () => {
    if (
      isReducedMotion ||
      !state.activeCardId ||
      state.layoutMode === "vertical" ||
      measuredCardHeight === undefined
    ) {
      root.style.removeProperty("--terminal-active-center-offset");
      return;
    }

    const selectedIndex = CARD_IDS.indexOf(state.activeCardId);
    const offset = getSelectedUnitCenterOffset({
      baseY: spreadTransforms[selectedIndex].y,
      cardHeight: measuredCardHeight,
    });
    root.style.setProperty("--terminal-active-center-offset", `${offset}px`);
  };

  const syncDom = () => {
    root.setAttribute("data-stack-open", String(state.isOpen));
    root.setAttribute("data-layout-mode", state.layoutMode);
    exploreButton.setAttribute("aria-expanded", String(state.isOpen));
    exploreButton.hidden = isReducedMotion || state.isLocked;
    nav.hidden = isReducedMotion || !state.isLocked;

    if (state.activeCardId) {
      root.setAttribute("data-active-card", state.activeCardId);
    } else {
      root.removeAttribute("data-active-card");
    }
    syncActiveCenterOffset();

    for (const button of numberButtons) {
      button.setAttribute(
        "aria-pressed",
        String(getCardId(button, "cardSelect") === state.activeCardId),
      );
    }

    titleButtons.forEach((button, index) => {
      if (!state.isLocked && index > 0) {
        button.setAttribute("disabled", "");
      } else {
        button.removeAttribute("disabled");
      }
    });
  };

  const getCurrentTransforms = () =>
    state.isOpen ? spreadTransforms : restTransforms;

  const getCardZIndex = (index: number) => {
    if (!state.activeCardId) {
      return getCurrentTransforms()[index].zIndex;
    }

    const selectedIndex = CARD_IDS.indexOf(state.activeCardId);
    return cards.length + 1 - Math.abs(index - selectedIndex);
  };

  const getTransformForCard = (index: number) => {
    const base = getCurrentTransforms()[index];
    const isActive = CARD_IDS[index] === state.activeCardId;
    return {
      transform: isActive
        ? getSelectedTransform(base, selectedSafeHalf)
        : base,
      zIndex: getCardZIndex(index),
    };
  };

  const setCurrentGeometry = () => {
    if (isReducedMotion || state.layoutMode === "vertical") {
      clearCardMotion(cards);
      return;
    }

    cards.forEach((card, index) => {
      const { transform, zIndex } = getTransformForCard(index);
      gsapApi.set(card, createTransformVars(transform, zIndex));
    });
  };

  const animateCurrentGeometry = (motion: StackMotion) => {
    gsapApi.killTweensOf(cards);

    if (isReducedMotion || state.layoutMode === "vertical") {
      clearCardMotion(cards);
      return;
    }

    cards.forEach((card, index) => {
      const { transform, zIndex } = getTransformForCard(index);
      gsapApi.to(card, {
        ...createTransformVars(transform, zIndex),
        delay: transform.delay,
        duration: motion.duration,
        ease: motion.ease,
        overwrite: true,
      });
    });
  };

  const measureFirstCard = () => {
    const parsePositivePixels = (value: string | undefined) => {
      const normalized = value?.trim();
      if (!normalized?.endsWith("px")) {
        return null;
      }

      const pixels = Number.parseFloat(normalized);
      return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
    };
    const measureCard = (card: StackElement) => {
      const view = root.ownerDocument?.defaultView;
      const computedStyle =
        view && typeof view.getComputedStyle === "function"
          ? view.getComputedStyle(card)
          : null;
      const computedHeight = parsePositivePixels(computedStyle?.height);
      const computedWidth = parsePositivePixels(computedStyle?.width);

      return {
        height: computedHeight ?? card.offsetHeight,
        width: computedWidth ?? card.offsetWidth,
      };
    };
    const firstCard = measureCard(cards[0]);
    const activeCardIndex = state.activeCardId
      ? CARD_IDS.indexOf(state.activeCardId)
      : 0;
    const expandedCardHeight =
      state.layoutMode === "vertical"
        ? measureCard(cards[activeCardIndex]).height
        : firstCard.height;

    return {
      height: Math.max(firstCard.height, expandedCardHeight),
      width: firstCard.width,
    };
  };

  const measureAndApply = () => {
    const { height: cardHeight, width: cardWidth } = measureFirstCard();
    const containerWidth = stage.clientWidth || stage.offsetWidth;
    const availableWidth = getViewportWidth(root, containerWidth);

    if (cardWidth <= 0 || cardHeight <= 0 || containerWidth <= 0) {
      syncDom();
      return;
    }

    measuredCardHeight = cardHeight;
    const layoutMode = getLayoutMode({
      availableWidth,
      cardCount: cards.length,
      cardHeight,
      cardWidth,
      containerWidth,
      viewportHeight: getViewportHeight(root, cardHeight),
    });
    restTransforms = getRestTransforms(cards.length);
    selectedSafeHalf = getSelectedSafeHalf({
      availableWidth,
      cardHeight,
      cardWidth,
    });
    spreadTransforms = getSpreadTransforms({
      availableWidth,
      cardCount: cards.length,
      cardHeight,
      cardWidth,
      compressed: layoutMode === "compressed",
      containerWidth,
    });
    state = reduceStackState(state, { type: "layout", layoutMode });
    syncDom();
    gsapApi.killTweensOf(cards);
    setCurrentGeometry();
  };

  const selectCard = (cardId: CardId) => {
    const previousActiveCardId = state.activeCardId;
    const nextState = reduceStackState(state, { type: "select", cardId });

    if (nextState === state) {
      return;
    }

    state = nextState;
    syncDom();

    if (!state.activeCardId) {
      animateCurrentGeometry(MOTION.release);
      return;
    }

    if (isReducedMotion || state.layoutMode === "vertical") {
      clearCardMotion(cards);
      return;
    }

    const currentTransforms = getCurrentTransforms();
    gsapApi.killTweensOf(cards);
    cards.forEach((card, index) => {
      const cardId = CARD_IDS[index];
      if (cardId !== previousActiveCardId && cardId !== state.activeCardId) {
        gsapApi.set(
          card,
          createTransformVars(currentTransforms[index], getCardZIndex(index)),
        );
      }
    });
    if (previousActiveCardId) {
      const previousIndex = CARD_IDS.indexOf(previousActiveCardId);
      const previousBase = currentTransforms[previousIndex];
      const previousZIndex = getCardZIndex(previousIndex);
      gsapApi.set(cards[previousIndex], { zIndex: previousZIndex });
      gsapApi.to(cards[previousIndex], {
        ...createTransformVars(previousBase, previousZIndex),
        duration: MOTION.release.duration,
        ease: MOTION.release.ease,
        overwrite: true,
      });
    }

    const selectedIndex = CARD_IDS.indexOf(cardId);
    const selectedTransform = getSelectedTransform(
      currentTransforms[selectedIndex],
      selectedSafeHalf,
    );
    const selectedZIndex = getCardZIndex(selectedIndex);
    gsapApi.set(cards[selectedIndex], { zIndex: selectedZIndex });
    gsapApi.to(cards[selectedIndex], {
      ...createTransformVars(selectedTransform, selectedZIndex),
      duration: MOTION.select.duration,
      ease: MOTION.select.ease,
      overwrite: true,
    });
  };

  const dispatch = (
    action: Exclude<StackAction, { type: "select" | "layout" }>,
    motion: StackMotion,
  ) => {
    const nextState = reduceStackState(state, action);

    if (nextState === state) {
      return;
    }

    state = nextState;
    syncDom();
    animateCurrentGeometry(motion);
  };

  const openLockedOverview = (suppressFocusRing = false) => {
    exploreButton.removeAttribute("data-pointer-hovered");
    if (suppressFocusRing) {
      overviewButton.setAttribute("data-suppress-focus-ring", "");
    } else {
      overviewButton.removeAttribute("data-suppress-focus-ring");
    }
    dispatch({ type: "lock-open" }, MOTION.open);
    overviewButton.focus();
  };

  const activateCard = (cardId: CardId, suppressFocusRing = false) => {
    if (state.activeCardId === cardId) {
      selectCard(cardId);
      return;
    }

    if (!state.isLocked) {
      if (!state.activeCardId && cardId === CARD_IDS[0]) {
        openLockedOverview(suppressFocusRing);
      }
      return;
    }

    selectCard(cardId);
  };

  const closesOutsideRoot = (event: FocusEvent | PointerEvent) => {
    const relatedTarget = event.relatedTarget;

    if (relatedTarget && root.contains(relatedTarget as Node)) {
      return;
    }

    dispatch({ type: "preview-close" }, MOTION.close);
  };

  const installInteractionListeners = () => {
    if (interactionsInstalled || isReducedMotion || isCleaned) {
      return;
    }

    interactionsInstalled = true;
    listen(exploreButton, "pointerenter", () => {
      exploreButton.setAttribute("data-pointer-hovered", "");
      dispatch({ type: "preview-open" }, MOTION.open);
    });
    listen(exploreButton, "pointerleave", () => {
      exploreButton.removeAttribute("data-pointer-hovered");
      dispatch({ type: "preview-close" }, MOTION.close);
    });
    listen(exploreButton, "focusin", () => {
      if (suppressExploreFocusPreview) {
        return;
      }
      dispatch({ type: "preview-open" }, MOTION.open);
    });
    listen(root, "pointerleave", closesOutsideRoot);
    listen(root, "focusout", closesOutsideRoot);
    listen(exploreButton, "click", (event) => {
      openLockedOverview(event.detail > 0);
    });
    listen(overviewButton, "focusout", () => {
      overviewButton.removeAttribute("data-suppress-focus-ring");
    });
    listen(overviewButton, "click", () => {
      exploreButton.removeAttribute("data-pointer-hovered");
      overviewButton.removeAttribute("data-suppress-focus-ring");
      dispatch({ type: "overview" }, MOTION.close);
      suppressExploreFocusPreview = true;
      try {
        exploreButton.focus();
      } finally {
        suppressExploreFocusPreview = false;
      }
    });

    titleButtons.forEach((button, index) => {
      listen(button, "click", (event) =>
        activateCard(CARD_IDS[index], event.detail > 0),
      );
    });
    numberButtons.forEach((button, index) => {
      listen(button, "click", () => activateCard(CARD_IDS[index]));
    });
  };

  const handleMotionChange = (event: MediaQueryListEvent) => {
    if (isCleaned || event.matches === isReducedMotion) {
      return;
    }

    isReducedMotion = event.matches;
    if (isReducedMotion) {
      root.setAttribute("data-reduced-motion", "true");
      state = reduceStackState(state, { type: "overview" });
      removeInteractionListeners();
      gsapApi.killTweensOf(cards);
      clearCardMotion(cards);
      syncDom();
      return;
    }

    root.removeAttribute("data-reduced-motion");
    measureAndApply();
    installInteractionListeners();
  };

  const gsapContext = gsapApi.context(() => {
    if (isReducedMotion) {
      root.setAttribute("data-reduced-motion", "true");
      clearCardMotion(cards);
      syncDom();
    } else {
      root.removeAttribute("data-reduced-motion");
      measureAndApply();
      installInteractionListeners();
    }
  }, root);

  root.setAttribute("data-initialized", "true");
  motionQuery.addEventListener("change", handleMotionChange);

  const scheduleResize = () => {
    if (isCleaned || pendingResize !== null) {
      return;
    }

    pendingResize = requestFrame(() => {
      pendingResize = null;
      if (!isCleaned) {
        measureAndApply();
      }
    });
  };

  const observer = ResizeObserverCtor
    ? new ResizeObserverCtor(scheduleResize)
    : null;
  observer?.observe(stage);
  viewportResizeTarget?.addEventListener("resize", scheduleResize);

  const removeAllListeners = () => {
    removeInteractionListeners();
    viewportResizeTarget?.removeEventListener("resize", scheduleResize);
  };

  const resources: StackCleanupResources = {
    cancelPendingResize: () => {
      if (pendingResize !== null) {
        cancelFrame(pendingResize);
        pendingResize = null;
      }
    },
    disconnectObserver: () => observer?.disconnect(),
    killActiveTweens: () => gsapApi.killTweensOf(cards),
    removeListeners: removeAllListeners,
    removeMotionListener: () =>
      motionQuery.removeEventListener("change", handleMotionChange),
    revertGsapContext: () => {
      gsapContext.revert();
      clearCardMotion(cards);
      root.style.removeProperty("--terminal-active-center-offset");
    },
  };

  return () => {
    if (isCleaned) {
      return;
    }

    isCleaned = true;
    cleanupStackResources(resources);
  };
}
