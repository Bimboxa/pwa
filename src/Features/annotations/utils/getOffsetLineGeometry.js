import { expandArcsInPath, typeOf } from "Features/geometry/utils/arcSampling";

// Geometry of an annotation's "ligne de déport" (offset line), in the same
// space as `points` (image px).
//
// - `points`: the offset chain — every segment of the main line (arcs
//   sampled) moved by `offset` along its right-of-direction normal, with
//   MITERED corners so the two lines stay parallel at exactly `offset`.
// - `segments`: the main-line segments the chain was built from, with their
//   unit normal — used to map a drag back to a signed offset.
// - `labels`: one anchor per ORIGINAL segment (an S-C-S arc counts as one),
//   on the offset line: position, direction angle and available length.
//
// Dependency free apart from the arc sampling (plain {x, y} objects).

const ARC_SAMPLES = 12;
// A corner sharper than this ratio is cut short instead of spiking away.
const MITER_LIMIT = 4;
const EPSILON = 1e-9;

function dedupePoints(path, closed) {
  const out = [];
  path.forEach((p) => {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < EPSILON) return;
    out.push(p);
  });
  if (closed && out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < EPSILON) out.pop();
  }
  return out;
}

function getSegments(path, closed) {
  const n = path.length;
  const count = closed ? n : n - 1;
  const segments = [];
  for (let i = 0; i < count; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const tx = dx / length;
    const ty = dy / length;
    // Right-of-direction normal (same side as offsetPointsAlongNormals).
    segments.push({ a, b, length, tx, ty, nx: ty, ny: -tx });
  }
  return segments;
}

function getOffsetPoints(path, segments, offset, closed) {
  const n = path.length;
  const m = segments.length;
  return path
    .map((p, i) => {
      const prev = closed ? segments[(i - 1 + m) % m] : segments[i - 1];
      const next = closed ? segments[i % m] : segments[i];
      if (!prev || !next) {
        const only = prev ?? next;
        return { x: p.x + only.nx * offset, y: p.y + only.ny * offset };
      }
      let mx = prev.nx + next.nx;
      let my = prev.ny + next.ny;
      const mLen = Math.hypot(mx, my);
      if (mLen < EPSILON) {
        // U-turn: no bisector, keep the incoming normal.
        return { x: p.x + prev.nx * offset, y: p.y + prev.ny * offset };
      }
      mx /= mLen;
      my /= mLen;
      const cos = mx * prev.nx + my * prev.ny;
      const ratio = Math.min(1 / Math.max(cos, EPSILON), MITER_LIMIT);
      return { x: p.x + mx * offset * ratio, y: p.y + my * offset * ratio };
    })
    .slice(0, n);
}

function getLabels(points, offset, closed) {
  const n = points.length;
  const labels = [];
  const get = closed ? (k) => points[((k % n) + n) % n] : (k) => points[k];
  const count = closed ? n : n - 1;
  let i = 0;
  while (i < count) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);
    const isArc =
      n >= 3 &&
      p1 &&
      p2 &&
      i + 2 <= (closed ? n : n - 1) &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";

    // Arc: anchored on its mid point (the "circle" vertex), along the chord.
    const from = p0;
    const to = isArc ? p2 : p1;
    const mid = isArc ? p1 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const length = isArc
      ? Math.hypot(p1.x - p0.x, p1.y - p0.y) +
        Math.hypot(p2.x - p1.x, p2.y - p1.y)
      : Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const chord = Math.hypot(dx, dy);
    if (chord > EPSILON) {
      const tx = dx / chord;
      const ty = dy / chord;
      const nx = ty;
      const ny = -tx;
      labels.push({
        x: mid.x + nx * offset,
        y: mid.y + ny * offset,
        nx,
        ny,
        angle: (Math.atan2(ty, tx) * 180) / Math.PI,
        length,
      });
    }
    i += isArc ? 2 : 1;
  }
  return labels;
}

export default function getOffsetLineGeometry({ points, closeLine, offset }) {
  const valid = (points ?? []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const source = dedupePoints(valid, closeLine);
  if (source.length < 2) return null;
  const closed = Boolean(closeLine) && source.length > 2;

  const path = dedupePoints(
    expandArcsInPath(source, ARC_SAMPLES, closed),
    closed
  );
  if (path.length < 2) return null;

  const segments = getSegments(path, closed);
  return {
    points: getOffsetPoints(path, segments, offset, closed),
    segments,
    labels: getLabels(source, offset, closed),
    closed,
  };
}
