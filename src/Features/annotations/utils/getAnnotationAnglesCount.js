import { circleFromThreePoints } from "Features/geometry/utils/arcSampling";

// Number of corners ("angles") of a POLYLINE / STRIP annotation.
//
// - Open line: interior vertices only; closed line (closeLine): every vertex,
//   so a square counts 4.
// - Arc control points (type "circle") are never corners. At an arc end the
//   arc tangent is used, so a tangent straight → arc junction is not a corner.
// - Collinear vertices (deviation below ANGLE_TOLERANCE_RAD) are not corners.
// - A vertex counts only when both adjacent segments are visible
//   (hiddenSegmentsIdx, segment i = point i → i + 1).
// - Closed lines add the corners of their cuts.
//
// Expects resolved points (pixel x / y). Returns null for other types.

const ANGLE_TOLERANCE_RAD = (1 * Math.PI) / 180;
const EPS = 1e-9;

function normalize(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: dx / len, y: dy / len };
}

// Unit tangent of the arc at point p, oriented along the travel direction
// (ccw: the arc turns counter-clockwise in the x / y frame).
function getArcTangent(center, p, ccw) {
  const t = normalize(-(p.y - center.y), p.x - center.x);
  if (!t) return null;
  return ccw ? t : { x: -t.x, y: -t.y };
}

// Splits the ring / line into straight or arc edges, each carrying its start
// and end directions — mirrors the S-C-S walk of getAnnotationQties.
function getEdges(points, isClosed, hiddenSegmentsIdx) {
  const n = points.length;
  const limit = isClosed ? n : n - 1;
  const hidden = new Set(hiddenSegmentsIdx || []);
  const edges = [];

  let i = 0;
  while (i < limit) {
    const i0 = i % n;
    const i1 = (i + 1) % n;
    const i2 = (i + 2) % n;
    const p0 = points[i0];
    const p1 = points[i1];
    const p2 = points[i2];

    const isArc =
      p0.type !== "circle" &&
      p1.type === "circle" &&
      (isClosed || i + 2 < n) &&
      p2.type !== "circle";

    if (isArc) {
      const visible = !hidden.has(i0) && !hidden.has(i1);
      const circ = circleFromThreePoints(p0, p1, p2);
      const turn =
        (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
      const chord = normalize(p2.x - p0.x, p2.y - p0.y);
      let startDir = chord;
      let endDir = chord;
      // Flat arc (collinear points): the chord direction is used.
      if (circ && Number.isFinite(circ.r) && Math.abs(turn) > EPS) {
        startDir = getArcTangent(circ.center, p0, turn > 0);
        endDir = getArcTangent(circ.center, p2, turn > 0);
      }
      if (startDir && endDir) {
        edges.push({ endIdx: i2, startDir, endDir, visible });
      }
      i += 2;
    } else {
      const dir = normalize(p1.x - p0.x, p1.y - p0.y);
      // Zero-length segments (duplicated points) are skipped.
      if (dir) {
        edges.push({
          endIdx: i1,
          startDir: dir,
          endDir: dir,
          visible: !hidden.has(i0),
        });
      }
      i += 1;
    }
  }

  return edges;
}

function countPathAngles(points, isClosed, hiddenSegmentsIdx) {
  const edges = getEdges(points, isClosed, hiddenSegmentsIdx);
  const pairsCount = isClosed ? edges.length : edges.length - 1;
  if (pairsCount <= 0 || (isClosed && edges.length < 2)) return 0;

  let count = 0;
  for (let k = 0; k < pairsCount; k++) {
    const a = edges[k];
    const b = edges[(k + 1) % edges.length];
    if (!a.visible || !b.visible) continue;
    if (points[a.endIdx]?.type === "circle") continue;
    const cross = a.endDir.x * b.startDir.y - a.endDir.y * b.startDir.x;
    const dot = a.endDir.x * b.startDir.x + a.endDir.y * b.startDir.y;
    if (Math.atan2(Math.abs(cross), dot) > ANGLE_TOLERANCE_RAD) count += 1;
  }
  return count;
}

function getResolvedPoints(points) {
  return (points || []).filter(
    (p) => p && typeof p.x === "number" && typeof p.y === "number"
  );
}

export default function getAnnotationAnglesCount(annotation) {
  if (!["POLYLINE", "STRIP"].includes(annotation?.type)) return null;

  const points = getResolvedPoints(annotation.points);
  if (points.length < 2) return null;

  const isClosed = Boolean(annotation.closeLine);
  let count = countPathAngles(points, isClosed, annotation.hiddenSegmentsIdx);

  if (isClosed && Array.isArray(annotation.cuts)) {
    for (const cut of annotation.cuts) {
      const cutPoints = getResolvedPoints(cut?.points);
      if (cutPoints.length < 3) continue;
      count += countPathAngles(cutPoints, true, cut.hiddenSegmentsIdx);
    }
  }

  return count;
}
