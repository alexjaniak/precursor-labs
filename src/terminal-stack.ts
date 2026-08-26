import gsap from "gsap";
import {
  CARD_IDS,
  MOTION,
  createInitialState,
  getLayoutMode,
  getRestTransforms,
  getSelectedTransform,
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

  if (view) {
    return view.matchMedia("(prefers-reduced-motion: reduce)");
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

function getViewportHeight(root: HTMLElement, cardHeight: number): number {
  return root.ownerDocument?.defaultView?.innerHeight ??
    (typeof window === "undefined" ? cardHeight + 200 : window.innerHeight);
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
  const requestFrame =
    dependencies.requestFrame ?? requestAnimationFrame.bind(globalThis);
  const cancelFrame =
    dependencies.cancelFrame ?? cancelAnimationFrame.bind(globalThis);
  const ResizeObserverCtor = dependencies.ResizeObserverCtor ?? ResizeObserver;
  const interactionCleanups: Array<() => void> = [];
  let state: StackState = createInitialState();
  let isCleaned = false;
  let interactionsInstalled = false;
  let isReducedMotion = motionQuery.matches;
  let pendingResize: number | null = null;
  let restTransforms = getRestTransforms(cards.length);
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
    interactionsInstalled = false;
  };

  const syncDom = () => {
    root.setAttribute("data-stack-open", String(state.isOpen));
    root.setAttribute("data-layout-mode", state.layoutMode);
    exploreButton.setAttribute("aria-expanded", String(state.isOpen));
    exploreButton.hidden = state.isLocked;
    nav.hidden = !state.isLocked;

    if (state.activeCardId) {
      root.setAttribute("data-active-card", state.activeCardId);
    } else {
      root.removeAttribute("data-active-card");
    }

    for (const button of numberButtons) {
      button.setAttribute(
        "aria-pressed",
        String(getCardId(button, "cardSelect") === state.activeCardId),
      );
    }
  };

  const getCurrentTransforms = () =>
    state.isOpen ? spreadTransforms : restTransforms;

  const getTransformForCard = (index: number) => {
    const base = getCurrentTransforms()[index];
    const isActive = CARD_IDS[index] === state.activeCardId;
    return {
      transform: isActive ? getSelectedTransform(base) : base,
      zIndex: isActive ? cards.length + 1 : base.zIndex,
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

  const animateCurrentGeometry = (motion: typeof MOTION.open | typeof MOTION.close) => {
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
        overwrite: "auto",
      });
    });
  };

  const measureFirstCard = () => {
    const firstCardHeight = cards[0].offsetHeight;
    const activeCardIndex = state.activeCardId
      ? CARD_IDS.indexOf(state.activeCardId)
      : 0;
    const expandedCardHeight =
      state.layoutMode === "vertical"
        ? cards[activeCardIndex].offsetHeight
        : firstCardHeight;

    return {
      height: Math.max(firstCardHeight, expandedCardHeight),
      width: cards[0].offsetWidth,
    };
  };

  const measureAndApply = () => {
    const { height: cardHeight, width: cardWidth } = measureFirstCard();
    const containerWidth = stage.clientWidth || stage.offsetWidth;

    if (cardWidth <= 0 || cardHeight <= 0 || containerWidth <= 0) {
      syncDom();
      return;
    }

    const layoutMode = getLayoutMode({
      cardCount: cards.length,
      cardHeight,
      cardWidth,
      containerWidth,
      viewportHeight: getViewportHeight(root, cardHeight),
    });
    restTransforms = getRestTransforms(cards.length);
    spreadTransforms = getSpreadTransforms({
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

    if (isReducedMotion || state.layoutMode === "vertical") {
      clearCardMotion(cards);
      return;
    }

    const currentTransforms = getCurrentTransforms();
    if (previousActiveCardId) {
      const previousIndex = CARD_IDS.indexOf(previousActiveCardId);
      const previousBase = currentTransforms[previousIndex];
      gsapApi.set(cards[previousIndex], { zIndex: previousBase.zIndex });
      gsapApi.to(cards[previousIndex], {
        ...createTransformVars(previousBase),
        duration: MOTION.release.duration,
        ease: MOTION.release.ease,
        overwrite: "auto",
      });
    }

    const selectedIndex = CARD_IDS.indexOf(cardId);
    const selectedTransform = getSelectedTransform(currentTransforms[selectedIndex]);
    gsapApi.set(cards[selectedIndex], { zIndex: cards.length + 1 });
    gsapApi.to(cards[selectedIndex], {
      ...createTransformVars(selectedTransform, cards.length + 1),
      duration: MOTION.select.duration,
      ease: MOTION.select.ease,
      overwrite: "auto",
    });
  };

  const dispatch = (
    action: Exclude<StackAction, { type: "select" | "layout" }>,
    motion: typeof MOTION.open | typeof MOTION.close,
  ) => {
    const nextState = reduceStackState(state, action);

    if (nextState === state) {
      return;
    }

    state = nextState;
    syncDom();
    animateCurrentGeometry(motion);
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
      dispatch({ type: "preview-open" }, MOTION.open);
    });
    listen(exploreButton, "focusin", () => {
      dispatch({ type: "preview-open" }, MOTION.open);
    });
    listen(root, "pointerleave", closesOutsideRoot);
    listen(root, "focusout", closesOutsideRoot);
    listen(exploreButton, "click", () => {
      dispatch({ type: "lock-open" }, MOTION.open);
      overviewButton.focus();
    });
    listen(overviewButton, "click", () => {
      dispatch({ type: "overview" }, MOTION.close);
      exploreButton.focus();
    });

    titleButtons.forEach((button, index) => {
      listen(button, "click", () => selectCard(CARD_IDS[index]));
    });
    numberButtons.forEach((button, index) => {
      listen(button, "click", () => selectCard(CARD_IDS[index]));
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

  const observer = new ResizeObserverCtor(() => {
    if (isCleaned || pendingResize !== null) {
      return;
    }

    pendingResize = requestFrame(() => {
      pendingResize = null;
      if (!isCleaned) {
        measureAndApply();
      }
    });
  });
  observer.observe(stage);

  const resources: StackCleanupResources = {
    cancelPendingResize: () => {
      if (pendingResize !== null) {
        cancelFrame(pendingResize);
        pendingResize = null;
      }
    },
    disconnectObserver: () => observer.disconnect(),
    killActiveTweens: () => gsapApi.killTweensOf(cards),
    removeListeners: removeInteractionListeners,
    removeMotionListener: () =>
      motionQuery.removeEventListener("change", handleMotionChange),
    revertGsapContext: () => {
      gsapContext.revert();
      clearCardMotion(cards);
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
