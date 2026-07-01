import {
  filletPinchCompoundPathData,
  type Bridge,
  type Circle,
  type Dot,
  type FilletPinchBall,
  type FilletPinchParams,
  type FilletPinchPathData,
  type Point,
} from "../../src/graphics/fillet-pinch.ts";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type LogoExportParams = FilletPinchParams & {
  backgroundColor?: string;
  dotColor?: string;
};

export type LogoExportOptions = {
  size?: number;
  padding?: number;
  bounds?: Bounds;
  includeBackground?: boolean;
  maskId?: string;
};

export type LogoExportResult = {
  svg: string;
  geometry: {
    balls: FilletPinchBall[];
    bridges: Bridge[];
    fillets: Circle[];
  };
  pathData: string;
  cutoutPathData: string;
  bounds: Bounds;
};

export function exportLogoToSvg(
  dots: Dot[],
  params: LogoExportParams,
  options: LogoExportOptions = {},
): LogoExportResult {
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

function opaqueShape(pathData: FilletPinchPathData, dotColor: string, backgroundColor: string): string {
  if (!pathData.positivePathData) return "";
  const cutouts = pathData.cutoutPathData
    ? `\n  <path d="${pathData.cutoutPathData}" fill="${backgroundColor}" />`
    : "";
  return `\n  <path d="${pathData.positivePathData}" fill="${dotColor}" fill-rule="nonzero" />${cutouts}`;
}

function transparentShape(
  pathData: FilletPinchPathData,
  dotColor: string,
  size: number,
  maskId: string,
): string {
  return maskedShape(pathData, dotColor, size, size, maskId);
}

function maskedShape(
  pathData: FilletPinchPathData,
  dotColor: string,
  width: number,
  height: number,
  maskId: string,
): string {
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

function logoBounds(dots: Dot[], params: LogoExportParams, padding: number): Bounds {
  const dotScale = params.dotScale ?? 1;
  const maxDotRadius = dots.reduce((max, dot) => Math.max(max, dotRadius(dot) * dotScale), 0);
  const pinchSpread = typeof params.pinchRadius === "number" && Number.isFinite(params.pinchRadius)
    ? params.pinchRadius
    : maxDotRadius * (typeof params.pinchRatio === "number" && Number.isFinite(params.pinchRatio) ? params.pinchRatio : 1);
  const spread = Math.max(0.02, pinchSpread) + padding;
  const extents = dots.reduce(
    (next, dot) => {
      const radius = dotRadius(dot) * dotScale + spread;
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

function worldToSvg(point: Point, bounds: Bounds, size: number): Point {
  return {
    x: ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * size,
    y: size - ((point.y - bounds.minY) / (bounds.maxY - bounds.minY)) * size,
  };
}

function dotRadius(dot: Dot): number {
  return dot.radius ?? dot.r ?? 0;
}

function escapeXml(value: string): string {
  const escapes: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  };
  return value.replace(/[<>&'"]/g, (character) => escapes[character] ?? character);
}
