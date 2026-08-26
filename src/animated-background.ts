const CELL_SIZE = 16;
const SQUARE_SIZE = 3;
const FRAME_INTERVAL = 1000 / 30;

type Ripple = {
  x: number;
  y: number;
  frequency: number;
  speed: number;
  phase: number;
};

export function startAnimatedBackground(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    return () => undefined;
  }

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let lastFrame = -FRAME_INTERVAL;
  let lastTime = 0;

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const draw = (time: number) => {
    context.clearRect(0, 0, width, height);

    const columns = Math.ceil(width / CELL_SIZE) + 1;
    const rows = Math.ceil(height / CELL_SIZE) + 1;
    const ripples: Ripple[] = [
      {
        x: width * 0.28 + Math.sin(time * 0.00017) * width * 0.18,
        y: height * 0.3 + Math.cos(time * 0.00015) * height * 0.2,
        frequency: 0.012,
        speed: 0.00065,
        phase: 0,
      },
      {
        x: width * 0.72 + Math.cos(time * 0.00013) * width * 0.16,
        y: height * 0.62 + Math.sin(time * 0.00018) * height * 0.18,
        frequency: 0.01,
        speed: 0.00055,
        phase: Math.PI * 0.6,
      },
      {
        x: width * 0.5 + Math.sin(time * 0.00011) * width * 0.24,
        y: height * 0.76 + Math.cos(time * 0.00016) * height * 0.12,
        frequency: 0.009,
        speed: 0.0005,
        phase: Math.PI,
      },
    ];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * CELL_SIZE;
        const y = row * CELL_SIZE;
        let strength = 0.34;

        for (const ripple of ripples) {
          const deltaX = x - ripple.x;
          const deltaY = y - ripple.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const wave = Math.sin(distance * ripple.frequency - time * ripple.speed + ripple.phase);
          const fade = Math.max(0.25, 1 - distance / Math.max(width, 1));
          strength += wave * 0.2 * fade;
        }

        strength += Math.sin((x + y) * 0.009 - time * 0.00035) * 0.11;
        strength += Math.sin((x - y) * 0.007 + time * 0.00028) * 0.08;
        strength = Math.max(0, Math.min(1, strength));

        const alpha = 0.035 + strength * 0.13;
        context.fillStyle = `rgba(113, 113, 107, ${alpha.toFixed(3)})`;
        context.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      }
    }
  };

  const animate = (time: number) => {
    if (time - lastFrame >= FRAME_INTERVAL) {
      lastFrame = time;
      lastTime = time;
      draw(time);
    }

    animationFrame = requestAnimationFrame(animate);
  };

  const stop = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  const start = () => {
    stop();
    draw(lastTime);

    if (!motionPreference.matches && !document.hidden) {
      animationFrame = requestAnimationFrame(animate);
    }
  };

  const handleResize = () => {
    resize();
    draw(lastTime);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stop();
      return;
    }

    start();
  };

  resize();
  start();
  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  motionPreference.addEventListener("change", start);

  return () => {
    stop();
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    motionPreference.removeEventListener("change", start);
  };
}
