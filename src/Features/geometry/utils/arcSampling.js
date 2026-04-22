// Shared arc-sampling helpers for POLYLINE / POLYGON annotations.
// Points can have type: "circle" or "square" (default).
// A square → circle → square (S-C-S) pattern represents a circular arc
// passing through the three points.

export function typeOf(p) {
  return p?.type === "circle" ? "circle" : "square";
}

export function circleFromThreePoints(p0, p1, p2) {
  const x1 = p0.x;
  const y1 = p0.y;
  const x2 = p1.x;
  const y2 = p1.y;
  const x3 = p2.x;
  const y3 = p2.y;

  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(d) < 1e-9) return null;

  const x1sq_y1sq = x1 * x1 + y1 * y1;
  const x2sq_y2sq = x2 * x2 + y2 * y2;
  const x3sq_y3sq = x3 * x3 + y3 * y3;

  const ux =
    (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) / d;
  const uy =
    (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) / d;

  const center = { x: ux, y: uy };
  const r = Math.hypot(x1 - ux, y1 - uy);
  return { center, r };
}

function angleFromCenter(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

export function sampleArcPoints(
  startPx,
  endPx,
  center,
  radius,
  isCW,
  samples = 10
) {
  const angleStart = angleFromCenter(center, startPx);
  const angleEnd = angleFromCenter(center, endPx);

  const TWO_PI = Math.PI * 2;

  let diff = angleEnd - angleStart;

  if (isCW) {
    while (diff < 0) diff += TWO_PI;
    while (diff >= TWO_PI) diff -= TWO_PI;
  } else {
    while (diff > 0) diff -= TWO_PI;
    while (diff <= -TWO_PI) diff += TWO_PI;
  }

  const absDiff = Math.abs(diff);
  const useLargeArc = absDiff > Math.PI;

  let angleSpan;
  if (useLargeArc) {
    angleSpan = TWO_PI - absDiff;
  } else {
    angleSpan = absDiff;
  }

  const arcPoints = [];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    let angle;
    if (isCW) {
      angle = angleStart + t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    } else {
      angle = angleStart - t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    }
    while (angle < 0) angle += TWO_PI;
    while (angle >= TWO_PI) angle -= TWO_PI;

    arcPoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return arcPoints;
}
