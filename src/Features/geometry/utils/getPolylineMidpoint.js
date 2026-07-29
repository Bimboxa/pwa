import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

/**
 * Point at HALF the arc-length of an OPEN polyline (S-C-S arcs expanded).
 *
 * points: pixel-space [{x, y, type?}]. samples: per-half-arc count — keep 16
 * (GUIDE_ARC_SAMPLES parity with slideProfileLineAlongGuide) so a midpoint
 * computed here projects back onto the same expanded chain at ~zero distance.
 * Returns {x, y} or null (fewer than 2 finite points / ~zero total length).
 */
export default function getPolylineMidpoint(points, samples = 16) {
  const pts = (points || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 2) return null;

  const path = expandArcsInPath(pts, samples, false);
  if (path.length < 2) return null;

  const cum = [0];
  for (let i = 1; i < path.length; i += 1) {
    cum.push(
      cum[i - 1] +
        Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    );
  }
  const total = cum[cum.length - 1];
  if (total < 1e-6) return null;

  const half = total / 2;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < half) i += 1;
  const seg = cum[i] - cum[i - 1];
  const f = seg > 0 ? (half - cum[i - 1]) / seg : 0;
  return {
    x: path[i - 1].x + (path[i].x - path[i - 1].x) * f,
    y: path[i - 1].y + (path[i].y - path[i - 1].y) * f,
  };
}
