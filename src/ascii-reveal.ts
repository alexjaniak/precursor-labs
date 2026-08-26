export const BRAND_REVEAL_TEXT = "PRECURSOR";
export const BRAND_REVEAL_HOLD_MS = 1500;
export const BRAND_SCRAMBLE_MS = 3500;

type CancelScheduledCallback = () => void;
type CancellableScheduler = (
  callback: () => void,
  delayMs: number,
) => CancelScheduledCallback;

type BrandRevealController = {
  shouldScramble: () => boolean;
  cancel: () => void;
};

export function isBrandLaunch(successfulLaunchCount: number): boolean {
  return successfulLaunchCount > 0 && successfulLaunchCount % 4 === 0;
}

export function startBrandRevealTimeline(
  schedule: CancellableScheduler,
  onReveal: (text: string) => void,
  onComplete: (text: string) => void,
): BrandRevealController {
  let isCancelled = false;
  let isScrambling = true;
  let cancelComplete: CancelScheduledCallback | undefined;

  const cancelReveal = schedule(() => {
    if (isCancelled) {
      return;
    }

    isScrambling = false;
    onReveal(BRAND_REVEAL_TEXT);

    if (isCancelled) {
      return;
    }

    cancelComplete = schedule(() => {
      if (!isCancelled) {
        onComplete(BRAND_REVEAL_TEXT);
      }
    }, BRAND_REVEAL_HOLD_MS);
  }, BRAND_SCRAMBLE_MS);

  return {
    shouldScramble: () => isScrambling && !isCancelled,
    cancel: () => {
      if (isCancelled) {
        return;
      }

      isCancelled = true;
      isScrambling = false;
      cancelReveal();
      cancelComplete?.();
    },
  };
}
