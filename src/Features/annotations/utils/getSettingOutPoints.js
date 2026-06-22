// Pure "setting out" (calepinage) computation: distribute POINT positions at a
// regular step along a single polyline, in image-pixel space.
//
// The polyline is split into RUNS delimited by "boundary" vertices. A vertex is
// a boundary (where the step counter restarts and a POINT is dropped) when:
//   - considerAngle && the turn angle at the vertex > ANGLE_THRESHOLD_DEG, OR
//   - considerHeight && its offsetBottom/offsetTop differs from the previous
//     vertex (a height/offset change).
// A vertex that is neither an angle break nor a height change is IGNORED: the
// run flows straight through it (a step may still land on or near it).
//
// Extremities (open lines only): the first/last vertex receive a POINT only when
// considerExtremities is set. Interior boundaries always receive one.
//
// POINT height mirrors the "Angle rentrants auto" procedure (heightReentrantAngles.js,
// vertexExtent): bottom = offsetZ + offsetBottom, top = offsetZ + height + offsetTop,
// then offsetZ = bottom, height = max(0, top - bottom). Offsets are interpolated
// linearly along a segment for intermediate step positions.
//
// When a produced position coincides with an existing polyline vertex (boundary,
// extremity or a step landing exactly on a vertex), the existing db.points id is
// returned as `pointId` so the caller can reuse it instead of minting a new point.

const EPS = 1e-6; // generic float tolerance (meters / offsets)
const ANGLE_THRESHOLD_DEG = 15; // turn angle above which a vertex is a corner
const SNAP_T = 1e-6; // parametric tolerance for "lands on a vertex"
const DECIMALS = 3;

const round3 = (x) => Math.round(x * 10 ** DECIMALS) / 10 ** DECIMALS;

function turnAngleDeg(prev, cur, next) {
  const v1x = cur.x - prev.x;
  const v1y = cur.y - prev.y;
  const v2x = next.x - cur.x;
  const v2y = next.y - cur.y;
  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;
  return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI);
}

function offsetsDiffer(a, b) {
  return (
    Math.abs((a.offsetBottom ?? 0) - (b.offsetBottom ?? 0)) > EPS ||
    Math.abs((a.offsetTop ?? 0) - (b.offsetTop ?? 0)) > EPS
  );
}

export default function getSettingOutPoints({
  points,
  closeLine,
  polylineOffsetZ = 0,
  polylineHeight = 0,
  meterByPx,
  stepM,
  considerHeight = true,
  considerAngle = true,
  considerExtremities = true,
}) {
  const n = points?.length ?? 0;
  if (n < 2) return [];
  if (!meterByPx || meterByPx <= 0) return [];
  const stepPx = stepM / meterByPx;
  if (!Number.isFinite(stepPx) || stepPx <= 0) return [];

  // height of a POINT sitting exactly on a polyline vertex (uses the vertex offsets)
  const vertexPoint = (v) => {
    const bottom = polylineOffsetZ + (v.offsetBottom ?? 0);
    const top = polylineOffsetZ + polylineHeight + (v.offsetTop ?? 0);
    return {
      x: v.x,
      y: v.y,
      offsetZ: round3(bottom),
      height: round3(Math.max(0, top - bottom)),
      pointId: v.id,
    };
  };

  // height of a POINT at fraction t on segment a -> b (offsets interpolated)
  const segmentPoint = (a, b, t) => {
    const x = a.x + t * (b.x - a.x);
    const y = a.y + t * (b.y - a.y);
    const ob = (a.offsetBottom ?? 0) + t * ((b.offsetBottom ?? 0) - (a.offsetBottom ?? 0));
    const ot = (a.offsetTop ?? 0) + t * ((b.offsetTop ?? 0) - (a.offsetTop ?? 0));
    const bottom = polylineOffsetZ + ob;
    const top = polylineOffsetZ + polylineHeight + ot;
    const point = {
      x,
      y,
      offsetZ: round3(bottom),
      height: round3(Math.max(0, top - bottom)),
    };
    // a step landing exactly on a (pass-through) vertex reuses that vertex id
    if (t <= SNAP_T) point.pointId = a.id;
    else if (t >= 1 - SNAP_T) point.pointId = b.id;
    return point;
  };

  // boundary classification (interior vertices)
  const isBoundary = (i) => {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const angleBreak =
      considerAngle && turnAngleDeg(prev, cur, next) > ANGLE_THRESHOLD_DEG;
    const heightBreak = considerHeight && offsetsDiffer(cur, prev);
    return angleBreak || heightBreak;
  };

  // build the linear traversal `path` + anchor positions (indices into path)
  let path;
  let anchorPositions;
  let placedAtPos; // pos -> boolean (only matters for the run-start placement)
  const isClosedTraversal = Boolean(closeLine);

  if (closeLine) {
    const boundaries = [];
    for (let i = 0; i < n; i++) if (isBoundary(i)) boundaries.push(i);

    const firstB = boundaries.length ? boundaries[0] : 0;
    path = [];
    for (let k = 0; k < n; k++) path.push(points[(firstB + k) % n]);
    path.push(points[firstB]); // close back to the first anchor

    if (boundaries.length) {
      anchorPositions = boundaries.map((b) => (b - firstB + n) % n);
    } else {
      anchorPositions = [0];
    }
    anchorPositions.push(n); // closing delimiter (end only, never a start)

    placedAtPos = () => true; // every closed run-start vertex gets a POINT
  } else {
    path = points.slice();
    const interior = [];
    for (let i = 1; i < n - 1; i++) if (isBoundary(i)) interior.push(i);
    anchorPositions = [0, ...interior, n - 1];
    placedAtPos = (pos) =>
      pos === 0 || pos === n - 1 ? considerExtremities : true;
  }

  // walk steps strictly inside a run [startPos, endPos] (exclusive of endPos vertex)
  const walkRun = (startPos, endPos, out) => {
    let acc = 0;
    let nextS = stepPx;
    for (let k = startPos; k < endPos; k++) {
      const a = path[k];
      const b = path[k + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen < EPS) continue;
      while (nextS <= acc + segLen - EPS) {
        const t = (nextS - acc) / segLen;
        out.push(segmentPoint(a, b, t));
        nextS += stepPx;
      }
      acc += segLen;
    }
  };

  // emit
  const result = [];
  for (let a = 0; a < anchorPositions.length - 1; a++) {
    const startPos = anchorPositions[a];
    const endPos = anchorPositions[a + 1];
    if (placedAtPos(startPos)) result.push(vertexPoint(path[startPos]));
    walkRun(startPos, endPos, result);
  }
  // final delimiter: open line places its last endpoint (gated by extremities);
  // closed traversal ends back on its first anchor (already placed) -> skip.
  if (!isClosedTraversal) {
    const lastPos = anchorPositions[anchorPositions.length - 1];
    if (placedAtPos(lastPos)) result.push(vertexPoint(path[lastPos]));
  }

  return result;
}
