import assert from "node:assert/strict";
import test from "node:test";

const revealModuleUrl = new URL("../src/ascii-reveal.ts", import.meta.url);

const loadRevealModule = () => import(revealModuleUrl.href);

function createFakeScheduler() {
  let currentTime = 0;
  let nextId = 0;
  const tasks = [];

  const schedule = (callback, delayMs) => {
    const task = {
      callback,
      cancelled: false,
      dueAt: currentTime + delayMs,
      id: nextId,
    };
    nextId += 1;
    tasks.push(task);

    return () => {
      task.cancelled = true;
    };
  };

  const advanceBy = (durationMs) => {
    const targetTime = currentTime + durationMs;

    while (true) {
      tasks.sort((left, right) => left.dueAt - right.dueAt || left.id - right.id);
      const nextTask = tasks.find((task) => !task.cancelled && task.dueAt <= targetTime);

      if (!nextTask) {
        break;
      }

      nextTask.cancelled = true;
      currentTime = nextTask.dueAt;
      nextTask.callback();
    }

    currentTime = targetTime;
  };

  const pendingTaskCount = () => tasks.filter((task) => !task.cancelled).length;

  return { advanceBy, pendingTaskCount, schedule };
}

test("exports the approved PRECURSOR reveal values", async () => {
  const { BRAND_REVEAL_HOLD_MS, BRAND_REVEAL_TEXT, BRAND_SCRAMBLE_MS } =
    await loadRevealModule();

  assert.equal(BRAND_REVEAL_TEXT, "PRECURSOR");
  assert.equal(BRAND_REVEAL_HOLD_MS, 1500);
  assert.equal(BRAND_SCRAMBLE_MS, 3500);
});

test("selects each positive fourth successful launch", async () => {
  const { isBrandLaunch } = await loadRevealModule();

  for (const count of [4, 8, 12]) {
    assert.equal(isBrandLaunch(count), true, `${count} must be a brand launch`);
  }

  for (const count of [-4, 0, 3, 5, 7, 9, 11, 13]) {
    assert.equal(isBrandLaunch(count), false, `${count} must not be a brand launch`);
  }
});

test("reveals after 3500 ms and completes after the full 1500 ms hold", async () => {
  const { startBrandRevealTimeline } = await loadRevealModule();
  const fakeClock = createFakeScheduler();
  let revealedText;
  let completedText;
  const controller = startBrandRevealTimeline(
    fakeClock.schedule,
    (text) => {
      revealedText = text;
    },
    (text) => {
      completedText = text;
    },
  );

  fakeClock.advanceBy(3499);
  assert.equal(controller.shouldScramble(), true);
  assert.equal(revealedText, undefined);

  fakeClock.advanceBy(1);
  assert.equal(revealedText, "PRECURSOR");
  assert.equal(controller.shouldScramble(), false);
  assert.equal(completedText, undefined);

  fakeClock.advanceBy(1499);
  assert.equal(completedText, undefined);

  fakeClock.advanceBy(1);
  assert.equal(completedText, "PRECURSOR");
});

test("cancellation before reveal prevents all pending callbacks", async () => {
  const { startBrandRevealTimeline } = await loadRevealModule();
  const fakeClock = createFakeScheduler();
  const callbacks = [];
  const controller = startBrandRevealTimeline(
    fakeClock.schedule,
    () => callbacks.push("reveal"),
    () => callbacks.push("complete"),
  );

  assert.equal(fakeClock.pendingTaskCount(), 1);
  controller.cancel();
  assert.equal(fakeClock.pendingTaskCount(), 0);
  fakeClock.advanceBy(5000);

  assert.deepEqual(callbacks, []);
  assert.equal(fakeClock.pendingTaskCount(), 0);
  assert.equal(controller.shouldScramble(), false);
});

test("cancellation during the hold prevents completion", async () => {
  const { startBrandRevealTimeline } = await loadRevealModule();
  const fakeClock = createFakeScheduler();
  const callbacks = [];
  const controller = startBrandRevealTimeline(
    fakeClock.schedule,
    () => callbacks.push("reveal"),
    () => callbacks.push("complete"),
  );

  fakeClock.advanceBy(3500);
  assert.equal(fakeClock.pendingTaskCount(), 1);
  controller.cancel();
  assert.equal(fakeClock.pendingTaskCount(), 0);
  fakeClock.advanceBy(1500);

  assert.deepEqual(callbacks, ["reveal"]);
  assert.equal(fakeClock.pendingTaskCount(), 0);
});
