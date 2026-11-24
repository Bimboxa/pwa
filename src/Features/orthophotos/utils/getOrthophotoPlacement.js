import computeQuadHomography from "./computeQuadHomography";

// How a unit orthophoto is laid on its base map, from its 4 corners
// (orthophoto.corners: [tl, tr, br, bl], normalized [0..1] on the base map
// reference image — see docs/baseMaps/ORTHOPHOTOS.md).
//
// - corners forming a parallelogram (the usual case: a rectified image only
//   needs a translation / rotation / scale) -> { kind: "AFFINE", matrix,
//   matrixStr }: an SVG matrix mapping the IMAGE px onto the base map px, so
//   the original file is drawn as is;
// - anything else -> { kind: "PROJECTIVE", H }: H maps the unit square of
//   the image onto the base map px, the image has to be warped
//   (bakeOrthophotoWarp).
// Both carry `cornersPx` and `bbox` in base map px. Null when unusable.

// Max gap (base map px) between the 4th corner and the parallelogram one.
export const AFFINE_TOLERANCE_PX = 0.5;

export function isValidOrthophotoCorners(corners) {
  return (
    Array.isArray(corners) &&
    corners.length === 4 &&
    corners.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
  );
}

export default function getOrthophotoPlacement({
  corners,
  baseMapSize,
  imageSize,
}) {
  const W = baseMapSize?.width;
  const H = baseMapSize?.height;
  const w = imageSize?.width;
  const h = imageSize?.height;
  if (!W || !H || !w || !h || !isValidOrthophotoCorners(corners)) return null;

  const cornersPx = corners.map((p) => ({ x: p.x * W, y: p.y * H }));
  const [p0, p1, p2, p3] = cornersPx;

  const homography = computeQuadHomography(cornersPx);
  if (!homography) return null;

  const xs = cornersPx.map((p) => p.x);
  const ys = cornersPx.map((p) => p.y);
  const bbox = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };

  const gap = Math.hypot(p0.x - p1.x + p2.x - p3.x, p0.y - p1.y + p2.y - p3.y);
  if (gap <= AFFINE_TOLERANCE_PX) {
    const matrix = {
      a: (p1.x - p0.x) / w,
      b: (p1.y - p0.y) / w,
      c: (p3.x - p0.x) / h,
      d: (p3.y - p0.y) / h,
      e: p0.x,
      f: p0.y,
    };
    return {
      kind: "AFFINE",
      matrix,
      matrixStr: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`,
      cornersPx,
      bbox,
    };
  }

  return { kind: "PROJECTIVE", H: homography, cornersPx, bbox };
}

// Default corners of an orthophoto added by hand: centered on the base map,
// a third of its width, keeping the image aspect ratio.
export function getDefaultOrthophotoCorners({ baseMapSize, imageSize }) {
  const W = baseMapSize?.width;
  const H = baseMapSize?.height;
  const w = imageSize?.width;
  const h = imageSize?.height;
  if (!W || !H || !w || !h) {
    return [
      { x: 1 / 3, y: 1 / 3 },
      { x: 2 / 3, y: 1 / 3 },
      { x: 2 / 3, y: 2 / 3 },
      { x: 1 / 3, y: 2 / 3 },
    ];
  }
  let widthPx = W / 3;
  let heightPx = (widthPx * h) / w;
  if (heightPx > H * 0.8) {
    heightPx = H * 0.8;
    widthPx = (heightPx * w) / h;
  }
  const x0 = (W - widthPx) / 2 / W;
  const x1 = (W + widthPx) / 2 / W;
  const y0 = (H - heightPx) / 2 / H;
  const y1 = (H + heightPx) / 2 / H;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}
