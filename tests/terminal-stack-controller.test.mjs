import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllerModuleUrl = new URL("../src/terminal-stack.ts", import.meta.url);
const modelModuleUrl = new URL("../src/terminal-stack-model.ts", import.meta.url);
const loadController = () => import(controllerModuleUrl.href);
const loadModel = () => import(modelModuleUrl.href);

class FakeStyle {
  constructor() {
    this.removedProperties = [];
    this.values = new Map();
  }

  getPropertyValue(property) {
    return this.values.get(property) ?? "";
  }

  removeProperty(property) {
    this.removedProperties.push(property);
    const previousValue = this.getPropertyValue(property);
    this.values.delete(property);
    return previousValue;
  }

  setProperty(property, value) {
    this.values.set(property, String(value));
  }
}

class FakeElement {
  constructor({
    cardId,
    cardSelect,
    height = 0,
    rectHeight,
    rectWidth,
    width = 0,
  } = {}) {
    this.attributes = new Map();
    this.clientWidth = width;
    this.dataset = {};
    this.focusCount = 0;
    this.hidden = false;
    this.listeners = new Map();
    this.offsetHeight = height;
    this.offsetWidth = width;
    this.onAttributeChange = null;
    this.style = new FakeStyle();
    this.containedElements = new Set([this]);

    if (rectHeight !== undefined || rectWidth !== undefined) {
      this.getBoundingClientRect = () => ({
        height: rectHeight ?? height,
        width: rectWidth ?? width,
      });
    }

    if (cardId) {
      this.dataset.cardId = cardId;
      this.attributes.set("data-card-id", cardId);
    }

    if (cardSelect) {
      this.dataset.cardSelect = cardSelect;
      this.attributes.set("data-card-select", cardSelect);
    }
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, values = {}) {
    const event = {
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      relatedTarget: null,
      target: this,
      type,
      ...values,
    };

    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }

    return event;
  }

  contains(element) {
    return this.containedElements.has(element);
  }

  focus() {
    this.focusCount += 1;
    this.emit("focusin");
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    this.onAttributeChange?.(name, null);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this.onAttributeChange?.(name, String(value));
  }

  listenerCount() {
    return [...this.listeners.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    );
  }
}

function createMotionQuery(initialMatches = false) {
  const listeners = new Set();

  return {
    addCount: 0,
    matches: initialMatches,
    media: "(prefers-reduced-motion: reduce)",
    removeCount: 0,
    addEventListener(type, listener) {
      assert.equal(type, "change");
      this.addCount += 1;
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, "change");
      this.removeCount += 1;
      listeners.delete(listener);
    },
    setMatches(matches) {
      this.matches = matches;
      for (const listener of [...listeners]) {
        listener({ matches, media: this.media, type: "change" });
      }
    },
  };
}

function createRaf() {
  let nextId = 1;
  const callbacks = new Map();
  const canceled = [];

  return {
    canceled,
    request(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      canceled.push(id);
      callbacks.delete(id);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) {
        callback(0);
      }
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

function createGsapApi() {
  const scheduledTweens = [];
  const calls = {
    contexts: [],
    events: [],
    killTweensOf: [],
    reverts: 0,
    sets: [],
    tweens: [],
  };

  return {
    calls,
    context(callback, scope) {
      calls.contexts.push(scope);
      calls.events.push({ scope, type: "context" });
      callback();
      return {
        revert() {
          calls.reverts += 1;
        },
      };
    },
    killTweensOf(targets) {
      calls.killTweensOf.push(targets);
      calls.events.push({ targets, type: "kill" });
      const targetSet = new Set(Array.isArray(targets) ? targets : [targets]);
      for (const tween of scheduledTweens) {
        if (targetSet.has(tween.target)) {
          tween.killed = true;
        }
      }
    },
    set(target, vars) {
      calls.sets.push({ target, vars: { ...vars } });
      calls.events.push({ target, type: "set", vars: { ...vars } });
      target.renderedVars = { ...target.renderedVars, ...vars };
    },
    to(target, vars) {
      calls.tweens.push({ target, vars: { ...vars } });
      calls.events.push({ target, type: "to", vars: { ...vars } });
      scheduledTweens.push({
        completesAt: (vars.delay ?? 0) + vars.duration,
        killed: false,
        target,
        vars: { ...vars },
      });
      return { kill() {} };
    },
    finishTweens() {
      scheduledTweens.sort((left, right) => left.completesAt - right.completesAt);
      for (const tween of scheduledTweens) {
        if (!tween.killed) {
          tween.target.renderedVars = {
            ...tween.target.renderedVars,
            ...tween.vars,
          };
        }
      }
    },
  };
}

function createHarness({
  cardComputedHeight,
  cardComputedWidth,
  cardHeight = 700,
  cardRectHeight,
  cardRectWidth,
  cardWidth = 560,
  containerWidth = 1240,
  reduced = false,
  viewportHeight,
  viewportWidth,
} = {}) {
  const cardIds = ["session-01", "session-02", "session-03", "session-04"];
  const root = new FakeElement();
  if (viewportHeight !== undefined || viewportWidth !== undefined) {
    const defaultView = {
      innerHeight: viewportHeight,
      innerWidth: viewportWidth,
    };
    if (cardComputedHeight !== undefined || cardComputedWidth !== undefined) {
      defaultView.getComputedStyle = () => ({
        height: `${cardComputedHeight ?? cardHeight}px`,
        width: `${cardComputedWidth ?? cardWidth}px`,
      });
    }
    root.ownerDocument = {
      defaultView,
    };
  }
  const stage = new FakeElement({ width: containerWidth });
  const cards = cardIds.map(
    (cardId) =>
      new FakeElement({
        cardId,
        height: cardHeight,
        rectHeight: cardRectHeight,
        rectWidth: cardRectWidth,
        width: cardWidth,
      }),
  );
  const titleButtons = cardIds.map(
    (cardSelect) => new FakeElement({ cardSelect }),
  );
  const exploreButton = new FakeElement();
  const overviewButton = new FakeElement();
  const nav = new FakeElement();
  const viewportResizeTarget = new FakeElement();
  const numberButtons = cardIds.map(
    (cardSelect) => new FakeElement({ cardSelect }),
  );
  const body = new FakeElement();
  const link = new FakeElement();
  const allElements = [
    root,
    stage,
    ...cards,
    ...titleButtons,
    exploreButton,
    overviewButton,
    nav,
    ...numberButtons,
    body,
    link,
  ];

  for (const element of allElements) {
    root.containedElements.add(element);
  }
  body.containedElements.add(link);

  const gsapApi = createGsapApi();
  const motionQuery = createMotionQuery(reduced);
  const raf = createRaf();
  const observerState = { instances: [] };

  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnectCount = 0;
      this.observed = [];
      observerState.instances.push(this);
    }

    disconnect() {
      this.disconnectCount += 1;
    }

    observe(target) {
      this.observed.push(target);
    }

    trigger() {
      this.callback([], this);
    }
  }

  return {
    body,
    cards,
    dependencies: {
      ResizeObserverCtor: FakeResizeObserver,
      cancelFrame: raf.cancel.bind(raf),
      elements: {
        cards,
        exploreButton,
        nav,
        numberButtons,
        overviewButton,
        stage,
        titleButtons,
      },
      gsapApi,
      motionQuery,
      requestFrame: raf.request.bind(raf),
      viewportResizeTarget,
    },
    exploreButton,
    gsapApi,
    link,
    motionQuery,
    nav,
    numberButtons,
    observerState,
    overviewButton,
    raf,
    root,
    stage,
    titleButtons,
    viewportResizeTarget,
  };
}

test("cleanupStackResources releases each resource exactly once", async () => {
  const { cleanupStackResources } = await loadController();
  const calls = {
    cancelPendingResize: 0,
    disconnectObserver: 0,
    killActiveTweens: 0,
    removeListeners: 0,
    removeMotionListener: 0,
    revertGsapContext: 0,
  };
  const resources = Object.fromEntries(
    Object.keys(calls).map((name) => [name, () => {
      calls[name] += 1;
    }]),
  );

  cleanupStackResources(resources);
  cleanupStackResources(resources);

  assert.deepEqual(calls, {
    cancelPendingResize: 1,
    disconnectObserver: 1,
    killActiveTweens: 1,
    removeListeners: 1,
    removeMotionListener: 1,
    revertGsapContext: 1,
  });
});

test("the real controller owns and idempotently cleans every resource", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const observer = harness.observerState.instances[0];

  assert.equal(harness.gsapApi.calls.contexts.length, 1);
  assert.strictEqual(harness.gsapApi.calls.contexts[0], harness.root);
  assert.deepEqual(observer.observed, [harness.stage]);

  harness.exploreButton.emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");

  observer.trigger();
  assert.equal(harness.raf.pendingCount(), 1);

  harness.motionQuery.setMatches(true);
  assert.equal(harness.root.getAttribute("data-reduced-motion"), "true");
  harness.motionQuery.setMatches(false);
  assert.equal(harness.root.hasAttribute("data-reduced-motion"), false);

  stop();
  const countersAfterCleanup = {
    canceled: harness.raf.canceled.length,
    disconnected: observer.disconnectCount,
    killed: harness.gsapApi.calls.killTweensOf.length,
    mediaRemoved: harness.motionQuery.removeCount,
    reverts: harness.gsapApi.calls.reverts,
    tweens: harness.gsapApi.calls.tweens.length,
  };
  const stackOpenAfterCleanup = harness.root.getAttribute("data-stack-open");

  assert.equal(observer.disconnectCount, 1);
  assert.equal(harness.raf.pendingCount(), 0);
  assert.equal(harness.raf.canceled.length, 1);
  assert.equal(harness.motionQuery.removeCount, 1);
  assert.equal(harness.gsapApi.calls.reverts, 1);
  assert.ok(harness.gsapApi.calls.killTweensOf.length >= 1);

  harness.overviewButton.emit("click");
  harness.exploreButton.emit("click");
  observer.trigger();
  harness.motionQuery.setMatches(true);
  stop();

  assert.equal(
    harness.root.getAttribute("data-stack-open"),
    stackOpenAfterCleanup,
  );
  assert.deepEqual(
    {
      canceled: harness.raf.canceled.length,
      disconnected: observer.disconnectCount,
      killed: harness.gsapApi.calls.killTweensOf.length,
      mediaRemoved: harness.motionQuery.removeCount,
      reverts: harness.gsapApi.calls.reverts,
      tweens: harness.gsapApi.calls.tweens.length,
    },
    countersAfterCleanup,
  );
});

test("Explore owns pointer and focus previews while the root provides a bridge", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const outside = new FakeElement();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.root.emit("pointerenter");
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");

  harness.exploreButton.emit("pointerenter");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.exploreButton.hasAttribute("data-pointer-hovered"), true);
  assert.equal(harness.exploreButton.getAttribute("aria-expanded"), "true");
  assert.equal(harness.exploreButton.hidden, false);
  assert.equal(harness.nav.hidden, true);

  harness.exploreButton.emit("pointerleave", {
    relatedTarget: harness.titleButtons[0],
  });
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");
  assert.equal(harness.exploreButton.hasAttribute("data-pointer-hovered"), false);

  harness.exploreButton.emit("pointerenter");

  harness.root.emit("pointerleave", { relatedTarget: harness.titleButtons[0] });
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  harness.root.emit("pointerleave", { relatedTarget: outside });
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");

  harness.exploreButton.emit("focusin");
  harness.root.emit("focusout", { relatedTarget: harness.titleButtons[1] });
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  harness.root.emit("focusout", { relatedTarget: outside });
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");

  harness.exploreButton.emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.exploreButton.hidden, true);
  assert.equal(harness.nav.hidden, false);
  assert.equal(harness.overviewButton.focusCount, 1);
  harness.exploreButton.setAttribute("data-pointer-hovered", "");
  harness.overviewButton.emit("click");
  assert.equal(harness.exploreButton.hasAttribute("data-pointer-hovered"), false);
  harness.root.emit("pointerleave", { relatedTarget: outside });
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");

  stop();
});

test("only session 01 opens the locked overview from the default state", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.titleButtons[0].hasAttribute("disabled"), false);
  assert.deepEqual(
    harness.titleButtons.slice(1).map((button) => button.hasAttribute("disabled")),
    [true, true, true],
  );

  harness.titleButtons[2].emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);

  harness.titleButtons[0].emit("click", { detail: 1 });
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);
  assert.equal(harness.exploreButton.hidden, true);
  assert.equal(harness.nav.hidden, false);
  assert.equal(harness.overviewButton.focusCount, 1);
  assert.equal(
    harness.overviewButton.hasAttribute("data-suppress-focus-ring"),
    true,
  );
  harness.overviewButton.emit("focusout", {
    relatedTarget: harness.titleButtons[0],
  });
  assert.equal(
    harness.overviewButton.hasAttribute("data-suppress-focus-ring"),
    false,
  );
  assert.deepEqual(
    harness.titleButtons.map((button) => button.hasAttribute("disabled")),
    [false, false, false, false],
  );

  stop();
});

test("keyboard expansion keeps the overview focus ring", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click", { detail: 0 });

  assert.equal(harness.overviewButton.focusCount, 1);
  assert.equal(
    harness.overviewButton.hasAttribute("data-suppress-focus-ring"),
    false,
  );

  stop();
});

test("reselecting the active title or number returns to the locked overview", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.titleButtons[2].emit("click");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-03");

  harness.titleButtons[2].emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);
  assert.equal(harness.exploreButton.hidden, true);
  assert.equal(harness.nav.hidden, false);

  harness.numberButtons[3].emit("click");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-04");

  harness.numberButtons[3].emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);
  assert.equal(harness.nav.hidden, false);

  stop();
});

test("stable title-bar and number selection preserves the active front card", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.titleButtons[2].emit("click");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-03");
  assert.deepEqual(
    harness.numberButtons.map((button) => button.getAttribute("aria-pressed")),
    ["false", "false", "true", "false"],
  );
  const selectedTween = harness.gsapApi.calls.tweens.at(-1);
  assert.strictEqual(selectedTween.target, harness.cards[2]);
  assert.equal(selectedTween.vars.zIndex, 5);
  assert.deepEqual(
    harness.cards.map((card) =>
      harness.gsapApi.calls.sets.findLast(({ target }) => target === card)?.vars.zIndex,
    ),
    [3, 4, 5, 4],
  );

  harness.root.emit("pointerleave", { relatedTarget: new FakeElement() });
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-03");

  harness.numberButtons[3].emit("click");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-04");
  assert.deepEqual(
    harness.numberButtons.map((button) => button.getAttribute("aria-pressed")),
    ["false", "false", "false", "true"],
  );
  assert.deepEqual(
    harness.cards.map((card) =>
      harness.gsapApi.calls.sets.findLast(({ target }) => target === card)?.vars.zIndex,
    ),
    [2, 3, 4, 5],
  );

  const beforeOverview = harness.gsapApi.calls.tweens.length;
  harness.overviewButton.emit("click");
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);
  assert.equal(harness.exploreButton.hidden, false);
  assert.equal(harness.nav.hidden, true);
  assert.equal(harness.exploreButton.focusCount, 1);
  assert.deepEqual(
    harness.numberButtons.map((button) => button.getAttribute("aria-pressed")),
    ["false", "false", "false", "false"],
  );
  assert.ok(harness.gsapApi.calls.tweens.length > beforeOverview);
  const sessionOneRestore = harness.gsapApi.calls.tweens.findLast(
    ({ target }) => target === harness.cards[0],
  );
  assert.equal(sessionOneRestore.vars.zIndex, 4);

  harness.exploreButton.emit("focusin");
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");

  stop();
});

test("selection sets the active center offset from card height and base fan y", async () => {
  const { startTerminalStack } = await loadController();
  const { getSelectedUnitCenterOffset, getSpreadTransforms } = await loadModel();
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const spreadTransforms = getSpreadTransforms({
    availableWidth: 1280,
    cardCount: 4,
    cardHeight: 600,
    cardWidth: 560,
    compressed: true,
    containerWidth: 1240,
  });

  harness.exploreButton.emit("click");
  harness.numberButtons[0].emit("click");
  const outerOffset = harness.root.style.getPropertyValue(
    "--terminal-active-center-offset",
  );
  assert.equal(
    outerOffset,
    `${getSelectedUnitCenterOffset({
      baseY: spreadTransforms[0].y,
      cardHeight: 600,
    })}px`,
  );

  harness.numberButtons[1].emit("click");
  const innerOffset = harness.root.style.getPropertyValue(
    "--terminal-active-center-offset",
  );
  assert.equal(
    innerOffset,
    `${getSelectedUnitCenterOffset({
      baseY: spreadTransforms[1].y,
      cardHeight: 600,
    })}px`,
  );
  assert.notEqual(innerOffset, outerOffset);

  stop();
});

test("resize recalculates the active center offset from measured card height", async () => {
  const { startTerminalStack } = await loadController();
  const { getSelectedUnitCenterOffset } = await loadModel();
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.numberButtons[0].emit("click");
  const beforeResize = harness.root.style.getPropertyValue(
    "--terminal-active-center-offset",
  );

  for (const card of harness.cards) {
    card.offsetHeight = 700;
  }
  harness.root.ownerDocument.defaultView.innerHeight = 1000;
  harness.observerState.instances[0].trigger();
  harness.raf.flush();

  const afterResize = harness.root.style.getPropertyValue(
    "--terminal-active-center-offset",
  );
  assert.equal(
    afterResize,
    `${getSelectedUnitCenterOffset({ baseY: -15, cardHeight: 700 })}px`,
  );
  assert.notEqual(afterResize, beforeResize);

  stop();
});

test("overview, vertical mode, and reduced motion remove the active center offset", async () => {
  const { startTerminalStack } = await loadController();
  const property = "--terminal-active-center-offset";
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.numberButtons[3].emit("click");
  assert.notEqual(harness.root.style.getPropertyValue(property), "");

  harness.overviewButton.emit("click");
  assert.equal(harness.root.style.getPropertyValue(property), "");

  harness.exploreButton.emit("click");
  harness.numberButtons[3].emit("click");
  harness.stage.clientWidth = 620;
  harness.stage.offsetWidth = 620;
  harness.root.ownerDocument.defaultView.innerWidth = 620;
  harness.observerState.instances[0].trigger();
  harness.raf.flush();
  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");
  assert.equal(harness.root.style.getPropertyValue(property), "");

  harness.stage.clientWidth = 1240;
  harness.stage.offsetWidth = 1240;
  harness.root.ownerDocument.defaultView.innerHeight = 900;
  harness.root.ownerDocument.defaultView.innerWidth = 1280;
  harness.observerState.instances[0].trigger();
  harness.raf.flush();
  assert.notEqual(harness.root.style.getPropertyValue(property), "");

  harness.motionQuery.setMatches(true);
  assert.equal(harness.root.getAttribute("data-reduced-motion"), "true");
  assert.equal(harness.root.style.getPropertyValue(property), "");

  stop();
});

test("selected card uses the measured horizontal cap in the expanded stack", async () => {
  const { startTerminalStack } = await loadController();
  const { getSelectedSafeHalf, getSelectedTransform, getSpreadTransforms } =
    await loadModel();
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const selectedSafeHalf = getSelectedSafeHalf({
    availableWidth: 1280,
    cardHeight: 600,
    cardWidth: 560,
  });

  harness.exploreButton.emit("click");
  harness.numberButtons[3].emit("click");

  const selectedTween = harness.gsapApi.calls.tweens.findLast(
    ({ target }) => target === harness.cards[3],
  );
  const spreadTransforms = getSpreadTransforms({
    availableWidth: 1280,
    cardCount: 4,
    cardHeight: 600,
    cardWidth: 560,
    compressed: true,
    containerWidth: 1240,
  });
  const expected = getSelectedTransform(
    spreadTransforms[3],
    selectedSafeHalf,
  );
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.deepEqual(
    [selectedTween.vars.x, selectedTween.vars.y, selectedTween.vars.scale],
    [expected.x, expected.y, expected.scale],
  );

  stop();
});

test("locked resize recomputes and applies the selected-card cap", async () => {
  const { startTerminalStack } = await loadController();
  const { getSelectedTransform, getSpreadTransforms } = await loadModel();
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.numberButtons[3].emit("click");

  harness.root.ownerDocument.defaultView.innerHeight = 1000;
  harness.root.ownerDocument.defaultView.innerWidth = 1600;
  harness.stage.clientWidth = 1440;
  harness.stage.offsetWidth = 1440;
  harness.observerState.instances[0].trigger();
  harness.raf.flush();

  const spreadTransforms = getSpreadTransforms({
    availableWidth: 1600,
    cardCount: 4,
    cardHeight: 600,
    cardWidth: 560,
    compressed: false,
    containerWidth: 1440,
  });
  const expected = getSelectedTransform(spreadTransforms[3]);
  assert.equal(harness.root.getAttribute("data-stack-open"), "true");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-04");
  assert.equal(harness.cards[3].renderedVars.x, expected.x);

  stop();
});

test("expanded selection always uses the measured cap", async () => {
  const source = readFileSync(controllerModuleUrl, "utf8");
  const { startTerminalStack } = await loadController();
  const normal = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stopNormal = startTerminalStack(normal.root, normal.dependencies);

  normal.exploreButton.emit("click");
  normal.numberButtons[3].emit("click");

  assert.match(
    source,
    /getSelectedTransform\(base,\s*selectedSafeHalf\)/,
  );
  assert.match(
    source,
    /getSelectedTransform\(\s*currentTransforms\[selectedIndex\],\s*selectedSafeHalf,?\s*\)/,
  );
  assert.doesNotMatch(source, /state\.isOpen\s*\?\s*selectedSafeHalf/);
  assert.equal(typeof normal.gsapApi.calls.tweens.at(-1).vars.x, "number");

  stopNormal();
});

test("controller uses the exact open, close, select, and release motion", async () => {
  const { startTerminalStack } = await loadController();
  const { MOTION, getSpreadTransforms } = await loadModel();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const expectedSpread = getSpreadTransforms({
    cardCount: 4,
    cardHeight: 700,
    cardWidth: 560,
    compressed: false,
    containerWidth: 1240,
  });

  harness.exploreButton.emit("click");
  const openTweens = harness.gsapApi.calls.tweens.slice(-4);
  assert.deepEqual(openTweens.map(({ vars }) => vars.zIndex), [4, 3, 2, 1]);
  assert.deepEqual(
    openTweens.map(({ vars }) => [vars.duration, vars.ease, vars.delay]),
    expectedSpread.map(({ delay }) => [MOTION.open.duration, MOTION.open.ease, delay]),
  );

  harness.titleButtons[0].emit("click");
  const selected = harness.gsapApi.calls.tweens.at(-1);
  assert.equal(selected.vars.duration, MOTION.select.duration);
  assert.equal(selected.vars.ease, MOTION.select.ease);
  assert.equal("delay" in selected.vars, false);
  const selectedLayer = harness.gsapApi.calls.sets.at(-1);
  assert.strictEqual(selectedLayer.target, harness.cards[0]);
  assert.deepEqual(selectedLayer.vars, { zIndex: 5 });

  const setsBeforeReselection = harness.gsapApi.calls.sets.length;
  harness.titleButtons[1].emit("click");
  const [released, nextSelected] = harness.gsapApi.calls.tweens.slice(-2);
  const reselectionSets = harness.gsapApi.calls.sets.slice(setsBeforeReselection);
  const releasedLayer = reselectionSets.find(
    ({ target, vars }) => target === harness.cards[0] && Object.keys(vars).length === 1,
  );
  const nextSelectedLayer = reselectionSets.find(
    ({ target, vars }) => target === harness.cards[1] && Object.keys(vars).length === 1,
  );
  assert.strictEqual(releasedLayer.target, harness.cards[0]);
  assert.deepEqual(releasedLayer.vars, { zIndex: 4 });
  assert.strictEqual(nextSelectedLayer.target, harness.cards[1]);
  assert.deepEqual(nextSelectedLayer.vars, { zIndex: 5 });
  assert.strictEqual(released.target, harness.cards[0]);
  assert.equal(released.vars.duration, MOTION.release.duration);
  assert.equal(released.vars.ease, MOTION.release.ease);
  assert.equal("delay" in released.vars, false);
  assert.strictEqual(nextSelected.target, harness.cards[1]);
  assert.equal(nextSelected.vars.duration, MOTION.select.duration);
  assert.equal(nextSelected.vars.ease, MOTION.select.ease);

  harness.overviewButton.emit("click");
  const closeTweens = harness.gsapApi.calls.tweens.slice(-4);
  assert.ok(
    closeTweens.every(
      ({ vars }) =>
        vars.duration === MOTION.close.duration && vars.ease === MOTION.close.ease,
    ),
  );

  stop();
});

test("a fast close cancels delayed open tweens before they can finish", async () => {
  const { startTerminalStack } = await loadController();
  const { getRestTransforms } = await loadModel();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const eventsBeforeInteraction = harness.gsapApi.calls.events.length;

  harness.exploreButton.emit("pointerenter");
  harness.root.emit("pointerleave", { relatedTarget: new FakeElement() });
  const interactionEvents = harness.gsapApi.calls.events.slice(eventsBeforeInteraction);
  assert.deepEqual(
    interactionEvents.map(({ type }) => type),
    ["kill", "to", "to", "to", "to", "kill", "to", "to", "to", "to"],
  );

  harness.gsapApi.finishTweens();
  const restTransforms = getRestTransforms(4);
  assert.deepEqual(
    harness.cards.map(({ renderedVars }) => [
      renderedVars.x,
      renderedVars.y,
      renderedVars.rotation,
      renderedVars.scale,
    ]),
    restTransforms.map(({ x, y, rotation, scale }) => [x, y, rotation, scale]),
  );
  assert.deepEqual(
    harness.gsapApi.calls.tweens.slice(-4).map(({ vars }) => vars.delay),
    restTransforms.map(({ delay }) => delay),
  );

  stop();
});

test("selection during opening completes every card at current geometry", async () => {
  const { startTerminalStack } = await loadController();
  const { getSelectedSafeHalf, getSelectedTransform, getSpreadTransforms } =
    await loadModel();
  const harness = createHarness({
    cardHeight: 600,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const spreadTransforms = getSpreadTransforms({
    cardCount: 4,
    availableWidth: 1280,
    cardHeight: 600,
    cardWidth: 560,
    compressed: true,
    containerWidth: 1240,
  });
  const selectedSafeHalf = getSelectedSafeHalf({
    availableWidth: 1280,
    cardHeight: 600,
    cardWidth: 560,
  });

  harness.exploreButton.emit("click");
  harness.titleButtons[0].emit("click");
  harness.gsapApi.finishTweens();

  const expectedTransforms = spreadTransforms.map((transform, index) =>
    index === 0
      ? getSelectedTransform(
          transform,
          selectedSafeHalf,
        )
      : transform,
  );
  assert.equal(harness.root.getAttribute("data-layout-mode"), "compressed");
  assert.deepEqual(
    harness.cards.map(({ renderedVars }) => [
      renderedVars.x,
      renderedVars.y,
      renderedVars.rotation,
      renderedVars.scale,
    ]),
    expectedTransforms.map(({ x, y, rotation, scale }) => [x, y, rotation, scale]),
  );

  stop();
});

test("resize keeps locked selection and rejects selection from an unlocked preview", async () => {
  const { startTerminalStack } = await loadController();
  const unlocked = createHarness();
  const stopUnlocked = startTerminalStack(unlocked.root, unlocked.dependencies);

  unlocked.exploreButton.emit("pointerenter");
  unlocked.titleButtons[1].emit("click");
  unlocked.stage.clientWidth = 620;
  unlocked.stage.offsetWidth = 620;
  unlocked.observerState.instances[0].trigger();
  unlocked.raf.flush();

  assert.equal(unlocked.root.getAttribute("data-layout-mode"), "vertical");
  assert.equal(unlocked.root.getAttribute("data-stack-open"), "false");
  assert.equal(unlocked.root.hasAttribute("data-active-card"), false);
  for (const card of unlocked.cards) {
    assert.ok(card.style.removedProperties.includes("transform"));
    assert.ok(card.style.removedProperties.includes("z-index"));
  }

  const locked = createHarness();
  const stopLocked = startTerminalStack(locked.root, locked.dependencies);
  locked.exploreButton.emit("click");
  locked.numberButtons[3].emit("click");
  locked.stage.clientWidth = 620;
  locked.stage.offsetWidth = 620;
  locked.observerState.instances[0].trigger();
  locked.raf.flush();

  assert.equal(locked.root.getAttribute("data-layout-mode"), "vertical");
  assert.equal(locked.root.getAttribute("data-stack-open"), "true");
  assert.equal(locked.root.getAttribute("data-active-card"), "session-04");
  assert.equal(locked.exploreButton.hidden, true);
  assert.equal(locked.nav.hidden, false);

  stopUnlocked();
  stopLocked();
});

test("viewport height resize uses the shared frame scheduler and cleans up", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness({
    cardHeight: 600,
    containerWidth: 1240,
    viewportHeight: 900,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.root.getAttribute("data-layout-mode"), "compressed");
  harness.root.ownerDocument.defaultView.innerHeight = 650;
  harness.viewportResizeTarget.emit("resize");
  assert.equal(harness.raf.pendingCount(), 1);
  harness.raf.flush();
  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");

  stop();
  harness.root.ownerDocument.defaultView.innerHeight = 900;
  harness.viewportResizeTarget.emit("resize");
  assert.equal(harness.raf.pendingCount(), 0);
  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");
});

test("computed card layout ignores transformed rectangles at the 594px boundary", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness({
    cardComputedHeight: 440,
    cardComputedWidth: 560,
    cardHeight: 440,
    cardRectHeight: 430.14,
    cardRectWidth: 550,
    cardWidth: 560,
    containerWidth: 1240,
    viewportHeight: 594,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.cards[0].offsetHeight, 440);
  assert.equal(harness.cards[0].getBoundingClientRect().height, 430.14);
  assert.equal(
    harness.root.ownerDocument.defaultView.getComputedStyle(harness.cards[0])
      .height,
    "440px",
  );
  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");

  stop();
});

test("card measurement falls back to positive offset dimensions", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness({
    cardHeight: 702,
    cardWidth: 560,
    containerWidth: 1240,
    viewportHeight: 900,
    viewportWidth: 1280,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.cards[0].getBoundingClientRect, undefined);
  assert.equal(
    harness.root.ownerDocument.defaultView.getComputedStyle,
    undefined,
  );
  assert.equal(harness.root.getAttribute("data-layout-mode"), "compressed");

  stop();
});

test("vertical resize measures the first card at its full uncollapsed height", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness({
    containerWidth: 620,
    viewportHeight: 700,
  });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");
  harness.titleButtons[0].emit("click");
  harness.titleButtons[1].emit("click");
  harness.cards[0].offsetHeight = 44;
  harness.cards[1].offsetHeight = 700;
  const activeCardAttributeChanges = [];
  harness.root.onAttributeChange = (name, value) => {
    if (name === "data-active-card") {
      activeCardAttributeChanges.push(value);
    }
  };
  harness.stage.clientWidth = 1240;
  harness.stage.offsetWidth = 1240;
  harness.observerState.instances[0].trigger();
  harness.raf.flush();

  assert.equal(harness.root.getAttribute("data-layout-mode"), "vertical");
  assert.equal(harness.root.getAttribute("data-active-card"), "session-02");
  assert.equal(harness.cards[0].offsetHeight, 44);
  assert.equal(activeCardAttributeChanges.includes(null), false);

  stop();
});

test("article bodies and links cannot control or cancel stack behavior", async () => {
  const source = readFileSync(controllerModuleUrl, "utf8");
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);
  const stateBefore = {
    active: harness.root.getAttribute("data-active-card"),
    open: harness.root.getAttribute("data-stack-open"),
    tweens: harness.gsapApi.calls.tweens.length,
  };

  const bodyClick = harness.body.emit("click");
  const linkClick = harness.link.emit("click");

  assert.deepEqual(
    {
      active: harness.root.getAttribute("data-active-card"),
      open: harness.root.getAttribute("data-stack-open"),
      tweens: harness.gsapApi.calls.tweens.length,
    },
    stateBefore,
  );
  assert.equal(bodyClick.defaultPrevented, false);
  assert.equal(linkClick.defaultPrevented, false);
  assert.doesNotMatch(source, /preventDefault\s*\(/);
  assert.doesNotMatch(source, /\.terminal-body/);
  assert.doesNotMatch(source, /listen\s*\(\s*(?:card|article|body|link)\b/);

  stop();
});

test("initial reduced motion clears motion and installs no fan interactions", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness({ reduced: true });
  const stop = startTerminalStack(harness.root, harness.dependencies);

  assert.equal(harness.root.getAttribute("data-reduced-motion"), "true");
  assert.equal(harness.exploreButton.hidden, true);
  assert.equal(harness.nav.hidden, true);
  assert.equal(harness.gsapApi.calls.sets.length, 0);
  assert.equal(harness.gsapApi.calls.tweens.length, 0);
  assert.equal(harness.root.listenerCount(), 0);
  assert.equal(harness.exploreButton.listenerCount(), 0);
  assert.equal(harness.overviewButton.listenerCount(), 0);
  assert.ok(harness.titleButtons.every((button) => button.listenerCount() === 0));
  assert.ok(harness.numberButtons.every((button) => button.listenerCount() === 0));
  for (const card of harness.cards) {
    assert.ok(card.style.removedProperties.includes("transform"));
    assert.ok(card.style.removedProperties.includes("z-index"));
  }

  harness.motionQuery.setMatches(false);
  assert.equal(harness.root.hasAttribute("data-reduced-motion"), false);
  assert.equal(harness.exploreButton.hidden, false);
  assert.equal(harness.nav.hidden, true);
  assert.ok(harness.exploreButton.listenerCount() > 0);
  assert.ok(harness.gsapApi.calls.sets.length > 0);
  const clearCountsBeforeCleanup = harness.cards.map(
    (card) => card.style.removedProperties.length,
  );

  stop();
  stop();
  assert.equal(harness.gsapApi.calls.reverts, 1);
  assert.deepEqual(
    harness.cards.map((card) => card.style.removedProperties.length),
    clearCountsBeforeCleanup.map((count) => count + 2),
  );
});

test("turning reduced motion on resets locked controls before listeners leave", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const stop = startTerminalStack(harness.root, harness.dependencies);

  harness.exploreButton.emit("click");
  harness.numberButtons[2].emit("click");
  assert.equal(harness.nav.hidden, false);
  assert.equal(harness.root.getAttribute("data-active-card"), "session-03");

  harness.motionQuery.setMatches(true);
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");
  assert.equal(harness.root.hasAttribute("data-active-card"), false);
  assert.equal(harness.exploreButton.hidden, true);
  assert.equal(harness.nav.hidden, true);

  harness.motionQuery.setMatches(false);
  assert.equal(harness.root.getAttribute("data-stack-open"), "false");
  assert.equal(harness.exploreButton.hidden, false);
  assert.equal(harness.nav.hidden, true);

  stop();
});

test("missing optional browser APIs keep initialization and cleanup safe", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  const dependencies = {
    elements: harness.dependencies.elements,
    gsapApi: harness.gsapApi,
  };
  let stop;

  assert.doesNotThrow(() => {
    stop = startTerminalStack(harness.root, dependencies);
  });
  assert.equal(harness.root.getAttribute("data-initialized"), "true");
  assert.doesNotThrow(() => {
    stop();
    stop();
  });
  assert.equal(harness.gsapApi.calls.reverts, 1);
});

test("incomplete stable markup returns a safe no-op cleanup", async () => {
  const { startTerminalStack } = await loadController();
  const harness = createHarness();
  harness.dependencies.elements.cards.pop();

  const stop = startTerminalStack(harness.root, harness.dependencies);
  stop();
  stop();

  assert.equal(harness.gsapApi.calls.contexts.length, 0);
  assert.equal(harness.root.hasAttribute("data-initialized"), false);
});
