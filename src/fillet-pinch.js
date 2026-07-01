const TAU = Math.PI * 2;
const DEFAULT_PINCH_RATIO = 0.8;

const blendGroups = {
  none: -1,
  top: 0,
  left: 1,
  right: 2,
  customA: 3,
  customB: 4,
  customC: 5,
};

const blendGroupLabels = {
  none: "none",
  top: "top",
  left: "left",
  right: "right",
  customA: "custom A",
  customB: "custom B",
  customC: "custom C",
};

export function fillet(c1, c2, k) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const R1 = c1.r + k;
  const R2 = c2.r + k;

  if (d >= R1 + R2 || d <= Math.abs(R1 - R2)) return null;

  const a = (d * d + R1 * R1 - R2 * R2) / (2 * d);
  const h2 = R1 * R1 - a * a;
  if (h2 <= 0) return null;

  const h = Math.sqrt(h2);
  const ux = dx / d;
  const uy = dy / d;
  const px = -uy;
  const py = ux;
  const mx = c1.x + a * ux;
  const my = c1.y + a * uy;

  return [
    { x: mx + h * px, y: my + h * py, r: k },
    { x: mx - h * px, y: my - h * py, r: k },
  ];
}

export function tangent(c, f) {
  const dx = f.x - c.x;
  const dy = f.y - c.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  return {
    x: c.x + (c.r * dx) / d,
    y: c.y + (c.r * dy) / d,
  };
}

export function filletPinchGeometry(dots, params = {}) {
  const balls = normalizeBalls(dots, params);
  const bridges = [];
  const fillets = [];
  const connectedPairs = new Set();

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const c1 = balls[i];
      const c2 = balls[j];
      if (!shouldConnect(c1, c2, params)) continue;
      if (!withinConnectionDistance(c1, c2, params)) continue;
      if (!passesConnectionChance(c1, c2, params)) continue;

      const k = pinchRadius(c1, c2, params);
      if (k <= 0) continue;

      const fs = fillet(c1, c2, k);
      if (!fs) continue;

      fillets.push(fs[0], fs[1]);
      bridges.push(bridgeGeometry(c1, c2, fs[0], fs[1]));
      if (Number.isFinite(params.gridStep)) {
        connectedPairs.add(pairKey(c1, c2, params.gridStep));
      }
    }
  }

  const cells = params.cellCutouts ? gridCells(balls, params, connectedPairs) : [];
  const cellFills = cells.map((cell) => ({ points: cell.points }));
  const cellCutouts = cells.map((cell) => cell.cutout);

  return { balls, bridges, fillets, cellFills, cellCutouts };
}

export function filletPinchCompoundPathData(dots, params = {}, mapPoint = identityPoint) {
  const geometry = filletPinchGeometry(dots, params);
  const positivePathData = [
    ...geometry.balls.map((ball) => circlePath(ball, mapPoint, 1)),
    ...geometry.cellFills.map((cell) => polygonPath(cell.points, mapPoint, 1)),
    ...geometry.bridges.map((bridge) => polygonPath(bridgeQuadPoints(bridge), mapPoint, 1)),
  ]
    .filter(Boolean)
    .join(" ");
  const cutoutPathData = [
    ...geometry.fillets.map((cutout) => polygonPath(circlePoints(cutout), mapPoint, -1)),
    ...geometry.cellCutouts.map((cutout) => polygonPath(circlePoints(cutout), mapPoint, -1)),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...geometry,
    pathData: [positivePathData, cutoutPathData].filter(Boolean).join(" "),
    positivePathData,
    cutoutPathData,
  };
}

export function drawFilletPinchCluster(
  ctx,
  dots,
  params = {},
  { mapPoint = identityPoint, color = "#111" } = {},
) {
  const geometry = filletPinchGeometry(dots, params);

  ctx.save();
  ctx.fillStyle = color;

  for (const ball of geometry.balls) {
    drawCircle(ctx, ball, mapPoint);
  }

  for (const cell of geometry.cellFills) {
    const [first, ...rest] = cell.points.map(mapPoint);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of rest) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  for (const bridge of geometry.bridges) {
    const [first, ...rest] = bridgeQuadPoints(bridge).map(mapPoint);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of rest) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalCompositeOperation = "destination-out";
  for (const cutout of geometry.fillets) {
    drawCircle(ctx, cutout, mapPoint);
  }
  for (const cutout of geometry.cellCutouts) {
    drawCircle(ctx, cutout, mapPoint);
  }

  ctx.restore();
}

function normalizeBalls(dots, params) {
  const dotScale = params.dotScale ?? 1;
  return dots
    .map((dot) => {
      const radius = (dot.r ?? dot.radius ?? 0) * dotScale;
      return {
        ...dot,
        r: radius,
        radius,
      };
    })
    .filter((dot) => dot.r > 0);
}

function shouldConnect(c1, c2, params) {
  const unionMode = params.unionMode ?? "custom groups";
  if (unionMode === "separate dots") return false;
  if (unionMode === "all dots") return true;

  const group1 = blendValue(c1.blend);
  return group1 >= 0 && group1 === blendValue(c2.blend);
}

function withinConnectionDistance(c1, c2, params) {
  if (!Number.isFinite(params.maxConnectionDistance)) return true;
  return Math.hypot(c2.x - c1.x, c2.y - c1.y) <= params.maxConnectionDistance;
}

function passesConnectionChance(c1, c2, params) {
  if (typeof params.connectPair === "function") return params.connectPair(c1, c2);
  if (!Number.isFinite(params.connectionChance)) return true;

  const chance = Math.min(1, Math.max(0, params.connectionChance));
  const seed = params.connectionSeed ?? 0;
  return hashUnit(`${seed}:${pointHash(c1)}:${pointHash(c2)}`) < chance;
}

function pinchRadius(c1, c2, params) {
  if (typeof params.pinchRadius === "function") {
    return Math.max(0, params.pinchRadius(c1, c2));
  }
  if (Number.isFinite(params.pinchRadius)) {
    return Math.max(0, params.pinchRadius);
  }

  const ratio = Number.isFinite(params.pinchRatio) ? params.pinchRatio : DEFAULT_PINCH_RATIO;
  return Math.max(0, Math.min(c1.r, c2.r) * ratio);
}

function gridCells(balls, params, connectedPairs) {
  const step = params.gridStep ?? inferGridStep(balls);
  if (!Number.isFinite(step) || step <= 0) return [];

  const lookup = new Map();
  for (const ball of balls) {
    lookup.set(gridKey(ball.x, ball.y, step), ball);
  }

  const cells = [];
  const seen = new Set();
  for (const ball of balls) {
    const origins = [
      [ball.x, ball.y],
      [ball.x - step, ball.y],
      [ball.x, ball.y - step],
      [ball.x - step, ball.y - step],
    ];

    for (const [x, y] of origins) {
      const key = gridKey(x, y, step);
      if (seen.has(key)) continue;

      const corners = [
        lookup.get(gridKey(x, y, step)),
        lookup.get(gridKey(x + step, y, step)),
        lookup.get(gridKey(x + step, y + step, step)),
        lookup.get(gridKey(x, y + step, step)),
      ];
      if (!corners.every(Boolean)) continue;
      if (connectedPairs.size && !cellEdgesConnected(corners, step, connectedPairs)) continue;

      seen.add(key);
      cells.push({
        points: [
          { x, y },
          { x: x + step, y },
          { x: x + step, y: y + step },
          { x, y: y + step },
        ],
        cutout: {
          x: x + step * 0.5,
          y: y + step * 0.5,
          r: Math.min(...corners.map((corner) => corner.r)),
        },
      });
    }
  }

  return cells;
}

function inferGridStep(balls) {
  const values = [...balls.map((ball) => ball.x), ...balls.map((ball) => ball.y)].sort((a, b) => a - b);
  let step = Infinity;
  for (let index = 1; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff > 1e-6) step = Math.min(step, diff);
  }
  return step;
}

function gridKey(x, y, step) {
  return `${Math.round(x / step)},${Math.round(y / step)}`;
}

function cellEdgesConnected(corners, step, connectedPairs) {
  return [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ].every(([a, b]) => connectedPairs.has(pairKey(a, b, step)));
}

function pairKey(a, b, step) {
  const first = gridKey(a.x, a.y, step);
  const second = gridKey(b.x, b.y, step);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function pointHash(point) {
  return `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)}`;
}

function hashUnit(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function labelToBlendKey(value) {
  return Object.entries(blendGroupLabels).find(([, label]) => label === value)?.[0] ?? value;
}

function blendValue(value) {
  return blendGroups[labelToBlendKey(value)] ?? -1;
}

function bridgeGeometry(c1, c2, f0, f1) {
  return {
    c1,
    c2,
    f0,
    f1,
    t1a: tangent(c1, f0),
    t2a: tangent(c2, f0),
    t2b: tangent(c2, f1),
    t1b: tangent(c1, f1),
  };
}

function bridgeQuadPoints(bridge) {
  return [bridge.t1a, bridge.t2a, bridge.t2b, bridge.t1b];
}

function circlePath(circle, mapPoint, sweep = 0) {
  const center = mapPoint(circle);
  const right = mapPoint({ x: circle.x + circle.r, y: circle.y });
  const left = mapPoint({ x: circle.x - circle.r, y: circle.y });
  const radius = Math.hypot(right.x - center.x, right.y - center.y);
  if (radius <= 0) return "";

  return [
    `M${format(right.x)} ${format(right.y)}`,
    `A${format(radius)} ${format(radius)} 0 1 ${sweep} ${format(left.x)} ${format(left.y)}`,
    `A${format(radius)} ${format(radius)} 0 1 ${sweep} ${format(right.x)} ${format(right.y)}`,
    "Z",
  ].join(" ");
}

function circlePoints(circle, segments = 64) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * TAU;
    return {
      x: circle.x + Math.cos(angle) * circle.r,
      y: circle.y + Math.sin(angle) * circle.r,
    };
  });
}

function polygonPath(points, mapPoint, targetSign = null) {
  if (!points.length) return "";

  let mapped = points.map(mapPoint);
  if (targetSign != null && Math.sign(signedArea(mapped)) !== targetSign) {
    mapped = [...mapped].reverse();
  }

  const [first, ...rest] = mapped;
  const commands = [`M${format(first.x)} ${format(first.y)}`];
  for (const point of rest) {
    commands.push(`L${format(point.x)} ${format(point.y)}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function drawCircle(ctx, circle, mapPoint) {
  ctx.beginPath();
  addCircleToCanvasPath(ctx, circle, mapPoint);
  ctx.fill();
}

function addCircleToCanvasPath(ctx, circle, mapPoint, anticlockwise = false) {
  const center = mapPoint(circle);
  const edge = mapPoint({ x: circle.x + circle.r, y: circle.y });
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
  if (radius <= 0) return false;

  ctx.moveTo(center.x + radius, center.y);
  ctx.arc(center.x, center.y, radius, 0, TAU, anticlockwise);
  ctx.closePath();
  return true;
}

function addPolygonToCanvasPath(ctx, points, mapPoint) {
  const [first, ...rest] = points.map(mapPoint);
  if (!first) return;

  ctx.moveTo(first.x, first.y);
  for (const point of rest) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function identityPoint(point) {
  return { x: point.x, y: point.y };
}

function format(value) {
  return Number(value.toFixed(3));
}
