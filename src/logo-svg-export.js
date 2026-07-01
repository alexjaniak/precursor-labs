import { filletPinchCompoundPathData } from "./fillet-pinch.js";

export function exportLogoToSvg(dots, params, options = {}) {
  const size = options.size ?? 1024;
  const padding = options.padding ?? 0.08;
  const bounds = options.bounds ?? logoBounds(dots, params, padding);
  const backgroundColor = params.backgroundColor ?? "#1a1a1a";
  const dotColor = params.dotColor ?? "#f4eee9";
  const pathData = filletPinchCompoundPathData(
    dots,
    params,
    (point) => worldToSvg(point, bounds, size),
  );
  const background = options.includeBackground === false
    ? ""
    : `\n  <rect width="${size}" height="${size}" fill="${backgroundColor}" />`;
  const shape = options.includeBackground === false
    ? transparentShape(pathData, dotColor, size, options.maskId ?? "fillet-pinch-logo-mask")
    : opaqueShape(pathData, dotColor, backgroundColor);
  const description = `Fillet-pinch SVG export, ${pathData.balls.length} balls, ${pathData.bridges.length} bridge${pathData.bridges.length === 1 ? "" : "s"}, ${pathData.fillets.length} pinch arc${pathData.fillets.length === 1 ? "" : "s"}.`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Liquid dot logo">\n  <desc>${escapeXml(description)}</desc>${background}${shape}\n</svg>\n`,
    geometry: {
      balls: pathData.balls,
      bridges: pathData.bridges,
      fillets: pathData.fillets,
    },
    pathData: pathData.pathData,
    cutoutPathData: pathData.cutoutPathData,
    bounds,
  };
}

function opaqueShape(pathData, dotColor, backgroundColor) {
  if (!pathData.positivePathData) return "";
  const cutouts = pathData.cutoutPathData
    ? `\n  <path d="${pathData.cutoutPathData}" fill="${backgroundColor}" />`
    : "";
  return `\n  <path d="${pathData.positivePathData}" fill="${dotColor}" fill-rule="nonzero" />${cutouts}`;
}

function transparentShape(pathData, dotColor, size, maskId) {
  return maskedShape(pathData, dotColor, size, size, maskId);
}

function maskedShape(pathData, dotColor, width, height, maskId) {
  if (!pathData.positivePathData) return "";
  const cutouts = pathData.cutoutPathData
    ? `\n      <path d="${pathData.cutoutPathData}" fill="black" />`
    : "";
  return `
  <defs>
    <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
      <path d="${pathData.positivePathData}" fill="white" />${cutouts}
    </mask>
  </defs>
  <path d="${pathData.positivePathData}" fill="${dotColor}" fill-rule="nonzero" mask="url(#${maskId})" />`;
}

function logoBounds(dots, params, padding) {
  const dotScale = params.dotScale ?? 1;
  const maxDotRadius = dots.reduce((max, dot) => Math.max(max, dot.radius * dotScale), 0);
  const pinchSpread = Number.isFinite(params.pinchRadius)
    ? params.pinchRadius
    : maxDotRadius * (Number.isFinite(params.pinchRatio) ? params.pinchRatio : 1);
  const spread = Math.max(0.02, pinchSpread) + padding;
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

function worldToSvg(point, bounds, size) {
  return {
    x: ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * size,
    y: size - ((point.y - bounds.minY) / (bounds.maxY - bounds.minY)) * size,
  };
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
