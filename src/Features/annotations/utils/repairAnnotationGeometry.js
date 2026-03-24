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

function repairPoints(points, isClosed) {
  if (!points || points.length < 3) return { points, outlierCount: 0 };

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

    const prev = points[prevIdx];
    const next = points[nextIdx];

    return {
      ...point,
      x: (prev.x + next.x) / 2,
      y: (prev.y + next.y) / 2,
    };
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
