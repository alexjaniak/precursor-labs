const GROUP_COUNT = 6;

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

function labelToBlendKey(value) {
  return Object.entries(blendGroupLabels).find(([, label]) => label === value)?.[0] ?? value;
}

function blendValue(value) {
  return blendGroups[labelToBlendKey(value)] ?? -1;
}

function smin(a, b, k) {
  if (k <= 0.0001) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

function dotSdf(point, dot, dotScale) {
  return Math.hypot(point.x - dot.x, point.y - dot.y) - dot.radius * dotScale;
}

export function logoField(point, dots, params) {
  const unionMode = params.unionMode ?? "custom groups";
  const liquidBlend = params.liquidBlend ?? 0;
  const dotScale = params.dotScale ?? 1;

  if (unionMode === "all dots") {
    return dots.reduce((field, dot) => smin(field, dotSdf(point, dot, dotScale), liquidBlend), 999);
  }

  if (unionMode === "separate dots") {
    return dots.reduce((field, dot) => Math.min(field, dotSdf(point, dot, dotScale)), 999);
  }

  let combined = 999;
  for (let group = 0; group < GROUP_COUNT; group += 1) {
    let groupField = 999;
    dots.forEach((dot) => {
      if (blendValue(dot.blend) === group) {
        groupField = smin(groupField, dotSdf(point, dot, dotScale), liquidBlend);
      }
    });
    combined = Math.min(combined, groupField);
  }

  dots.forEach((dot) => {
    if (blendValue(dot.blend) < 0) {
      combined = Math.min(combined, dotSdf(point, dot, dotScale));
    }
  });

  return combined;
}

export function exportLogoToSvg(dots, params, options = {}) {
  const size = options.size ?? 1024;
  const resolution = options.resolution ?? 768;
  const padding = options.padding ?? 0.08;
  const simplifyTolerance = options.simplifyTolerance ?? 0.0002;
  const bounds = options.bounds ?? logoBounds(dots, params, padding);
  const contours = marchingSquares(dots, params, bounds, resolution)
    .map((contour) => simplifyClosedPolyline(contour, simplifyTolerance))
    .filter((contour) => contour.length > 2);
  const pathData = contours.map((contour) => contourToPath(contour, bounds, size)).join(" ");
  const backgroundColor = params.backgroundColor ?? "#1a1a1a";
  const dotColor = params.dotColor ?? "#f4eee9";
  const background = options.includeBackground === false
    ? ""
    : `\n  <rect width="${size}" height="${size}" fill="${backgroundColor}" />`;
  const path = pathData
    ? `\n  <path d="${pathData}" fill="${dotColor}" fill-rule="evenodd" />`
    : "";
  const description = `Marching-squares SVG export, ${resolution}x${resolution} samples, ${contours.length} contour${contours.length === 1 ? "" : "s"}.`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Liquid dot logo">\n  <desc>${escapeXml(description)}</desc>${background}${path}\n</svg>\n`,
    contours,
    pathData,
    bounds,
    resolution,
  };
}

function logoBounds(dots, params, padding) {
  const dotScale = params.dotScale ?? 1;
  const liquidBlend = params.liquidBlend ?? 0;
  const spread = Math.max(0.02, liquidBlend) + padding;
  const extents = dots.reduce(
    (next, dot) => {
      const radius = dot.radius * dotScale + spread;
      return {
        minX: Math.min(next.minX, dot.x - radius),
        minY: Math.min(next.minY, dot.y - radius),
        maxX: Math.max(next.maxX, dot.x + radius),
        maxY: Math.max(next.maxY, dot.y + radius),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const width = extents.maxX - extents.minX;
  const height = extents.maxY - extents.minY;
  const side = Math.max(width, height);
  const centerX = (extents.minX + extents.maxX) * 0.5;
  const centerY = (extents.minY + extents.maxY) * 0.5;

  return {
    minX: centerX - side * 0.5,
    minY: centerY - side * 0.5,
    maxX: centerX + side * 0.5,
    maxY: centerY + side * 0.5,
  };
}

function marchingSquares(dots, params, bounds, resolution) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const values = Array.from({ length: resolution + 1 }, (_, y) =>
    Array.from({ length: resolution + 1 }, (_, x) =>
      logoField(
        {
          x: bounds.minX + (x / resolution) * width,
          y: bounds.minY + (y / resolution) * height,
        },
        dots,
        params,
      ),
    ),
  );
  const segments = [];

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const corners = [
        { x, y, value: values[y][x] },
        { x: x + 1, y, value: values[y][x + 1] },
        { x: x + 1, y: y + 1, value: values[y + 1][x + 1] },
        { x, y: y + 1, value: values[y + 1][x] },
      ];
      const mask = corners.reduce((next, corner, index) => next | (corner.value <= 0 ? 1 << index : 0), 0);
      if (mask === 0 || mask === 15) continue;

      cellSegments(mask, values[y][x], values[y][x + 1], values[y + 1][x + 1], values[y + 1][x]).forEach(
        ([fromEdge, toEdge]) => {
          segments.push([
            edgePoint(fromEdge, corners, bounds, resolution),
            edgePoint(toEdge, corners, bounds, resolution),
          ]);
        },
      );
    }
  }

  return stitchSegments(segments);
}

function cellSegments(mask, v0, v1, v2, v3) {
  if (mask === 5) {
    return (v0 + v1 + v2 + v3) * 0.25 <= 0
      ? [
          [3, 2],
          [0, 1],
        ]
      : [
          [3, 0],
          [1, 2],
        ];
  }
  if (mask === 10) {
    return (v0 + v1 + v2 + v3) * 0.25 <= 0
      ? [
          [0, 3],
          [1, 2],
        ]
      : [
          [0, 1],
          [2, 3],
        ];
  }

  return {
    1: [[3, 0]],
    2: [[0, 1]],
    3: [[3, 1]],
    4: [[1, 2]],
    6: [[0, 2]],
    7: [[3, 2]],
    8: [[2, 3]],
    9: [[0, 2]],
    11: [[1, 2]],
    12: [[1, 3]],
    13: [[0, 1]],
    14: [[3, 0]],
  }[mask] ?? [];
}

function edgePoint(edge, corners, bounds, resolution) {
  const pairs = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  const [a, b] = pairs[edge];
  const t = a.value === b.value ? 0.5 : clamp(a.value / (a.value - b.value), 0, 1);
  const gridX = lerp(a.x, b.x, t);
  const gridY = lerp(a.y, b.y, t);

  return {
    x: bounds.minX + (gridX / resolution) * (bounds.maxX - bounds.minX),
    y: bounds.minY + (gridY / resolution) * (bounds.maxY - bounds.minY),
  };
}

function stitchSegments(segments) {
  const adjacency = new Map();
  const used = new Set();

  segments.forEach((segment, index) => {
    segment.forEach((point, endpoint) => {
      const key = pointKey(point);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push({ segment: index, endpoint });
    });
  });

  const contours = [];
  segments.forEach((segment, index) => {
    if (used.has(index)) return;

    used.add(index);
    const contour = [segment[0], segment[1]];
    let current = segment[1];
    const startKey = pointKey(segment[0]);

    while (pointKey(current) !== startKey) {
      const next = (adjacency.get(pointKey(current)) ?? []).find((candidate) => !used.has(candidate.segment));
      if (!next) break;

      used.add(next.segment);
      const nextSegment = segments[next.segment];
      current = next.endpoint === 0 ? nextSegment[1] : nextSegment[0];
      contour.push(current);
    }

    if (contour.length > 2 && pointKey(contour[contour.length - 1]) === startKey) {
      contour.pop();
      contours.push(contour);
    }
  });

  return contours;
}

function simplifyClosedPolyline(points, tolerance) {
  if (points.length < 4 || tolerance <= 0) return points;
  const open = [...points, points[0]];
  const simplified = simplifyPolyline(open, tolerance);
  if (simplified.length > 1 && samePoint(simplified[0], simplified[simplified.length - 1])) {
    simplified.pop();
  }
  return simplified;
}

function simplifyPolyline(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let maxIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];

  const left = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
  const right = simplifyPolyline(points.slice(maxIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function contourToPath(contour, bounds, size) {
  const commands = contour.map((point, index) => {
    const svgPoint = worldToSvg(point, bounds, size);
    const command = index === 0 ? "M" : "L";
    return `${command}${format(svgPoint.x)} ${format(svgPoint.y)}`;
  });
  return `${commands.join(" ")} Z`;
}

function worldToSvg(point, bounds, size) {
  return {
    x: ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * size,
    y: size - ((point.y - bounds.minY) / (bounds.maxY - bounds.minY)) * size,
  };
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t = clamp(((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (lineStart.x + t * dx), point.y - (lineStart.y + t * dy));
}

function samePoint(a, b) {
  return pointKey(a) === pointKey(b);
}

function pointKey(point) {
  return `${Math.round(point.x * 1e9)},${Math.round(point.y * 1e9)}`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function format(value) {
  return Number(value.toFixed(3));
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}
