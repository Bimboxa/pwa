/**
 * Detects and repairs outlier points in annotation geometry.
 * After a merge, some points can end up with wildly incorrect coordinates.
 * This utility detects them using MAD (median absolute deviation) and replaces
 * their coordinates with the midpoint of their two neighboring points.
 */

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianAbsoluteDeviation(values) {
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

function repairTwoPoints(points) {
  const [a, b] = points;
  const magA = Math.abs(a.x) + Math.abs(a.y);
  const magB = Math.abs(b.x) + Math.abs(b.y);
  const ratio = magA > 0 && magB > 0 ? Math.max(magA, magB) / Math.min(magA, magB) : 0;

  // If coordinates are within the same order of magnitude, no outlier
  if (ratio < 100) return { points, outlierCount: 0 };

  // The point with larger magnitude is the outlier; snap it near the other
  const OFFSET = 10;
  if (magB > magA) {
    return {
      points: [a, { ...b, x: a.x + OFFSET, y: a.y }],
      outlierCount: 1,
    };
  }
  return {
    points: [{ ...a, x: b.x + OFFSET, y: b.y }, b],
    outlierCount: 1,
  };
}

function repairPoints(points, isClosed) {
  if (!points || points.length < 2) return { points, outlierCount: 0 };

  if (points.length === 2) return repairTwoPoints(points);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const medX = median(xs);
  const medY = median(ys);
  const madX = medianAbsoluteDeviation(xs);
  const madY = medianAbsoluteDeviation(ys);

  // Threshold multiplier for outlier detection
  const THRESHOLD = 10;
  // Fallback: if MAD is 0 (all points nearly identical), use absolute range
  const rangeX = Math.max(madX * THRESHOLD, 50);
  const rangeY = Math.max(madY * THRESHOLD, 50);

  let outlierCount = 0;
  const repairedPoints = points.map((point, i) => {
    const isOutlierX = Math.abs(point.x - medX) > rangeX;
    const isOutlierY = Math.abs(point.y - medY) > rangeY;

    if (!isOutlierX && !isOutlierY) return point;

    outlierCount++;

    // Get neighbors (wrap around for closed shapes)
    const n = points.length;
    const prevIdx = isClosed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const nextIdx = isClosed ? (i + 1) % n : Math.min(n - 1, i + 1);

    // For open-polyline endpoints, one neighbor clamps to itself.
    // Use only the valid neighbor so the outlier's own coords don't leak in.
    const hasPrev = prevIdx !== i;
    const hasNext = nextIdx !== i;
    const prev = points[prevIdx];
    const next = points[nextIdx];

    const newX =
      hasPrev && hasNext ? (prev.x + next.x) / 2 : hasPrev ? prev.x : next.x;
    const newY =
      hasPrev && hasNext ? (prev.y + next.y) / 2 : hasPrev ? prev.y : next.y;

    return { ...point, x: newX, y: newY };
  });

  return { points: repairedPoints, outlierCount };
}

export default function repairAnnotationGeometry(annotation) {
  if (!annotation?.points?.length) return null;

  const isClosed =
    annotation.type === "POLYGON" || annotation.closeLine === true;

  const { points: repairedPoints, outlierCount: pointsOutlierCount } =
    repairPoints(annotation.points, isClosed);

  let repairedCuts = annotation.cuts;
  let cutsOutlierCount = 0;

  if (annotation.cuts?.length) {
    repairedCuts = annotation.cuts.map((cut) => {
      const { points: repairedCutPoints, outlierCount } = repairPoints(
        cut.points,
        true
      );
      cutsOutlierCount += outlierCount;
      return { ...cut, points: repairedCutPoints };
    });
  }

  const totalOutlierCount = pointsOutlierCount + cutsOutlierCount;
  if (totalOutlierCount === 0) return null;

  return {
    repairedPoints,
    repairedCuts,
    outlierCount: totalOutlierCount,
  };
}
