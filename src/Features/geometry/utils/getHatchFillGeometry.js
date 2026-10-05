import polygonClipping from "polygon-clipping";

// Hatched fill of a planar face, as real-world geometry (3D viewer): a solid
// band along every border of the face (contour + holes) and oblique lines
// inside. Everything here is 2D, in meters, in the frame of the face.

export const HATCH_BAND_WIDTH_M = 0.1;
export const HATCH_SPACING_M = 0.2;
export const HATCH_LINE_WIDTH_PX = 1.5;

const JOINT_SIDES = 12;
const EPS = 1e-9;

// Unit direction of the lines (d) and of their normal (m).
// direction = 1 → "/" (HATCHING), -1 → "\" (HATCHING_LEFT), in a Y-up frame.
function getHatchAxes(direction) {
  const s = Math.SQRT1_2;
  return direction < 0 ? { d: [s, -s], m: [s, s] } : { d: [s, s], m: [s, -s] };
}

function closeRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

// The face region from its border loops, whatever their nesting / winding.
function getFaceRegion(loops) {
  const polygons = loops
    .filter((loop) => loop?.length >= 3)
    .map((loop) => [closeRing(loop)]);
  if (!polygons.length) return [];
  if (polygons.length === 1) return polygonClipping.union(polygons[0]);
  return polygonClipping.xor(polygons[0], ...polygons.slice(1));
}

// Everything at less than `width` from the borders: one rectangle per edge +
// one disc per vertex (round joints, so the band matches the distance test of
// isPointOnHatchInk).
function getBorderBuffer(loops, width) {
  const shapes = [];
  for (const loop of loops) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = loop[i];
      const [bx, by] = loop[(i + 1) % n];
      const disc = [];
      for (let k = 0; k < JOINT_SIDES; k++) {
        const angle = (2 * Math.PI * k) / JOINT_SIDES;
        disc.push([ax + width * Math.cos(angle), ay + width * Math.sin(angle)]);
      }
      shapes.push([closeRing(disc)]);

      const length = Math.hypot(bx - ax, by - ay);
      if (length < EPS) continue;
      const nx = (-(by - ay) / length) * width;
      const ny = ((bx - ax) / length) * width;
      shapes.push([
        closeRing([
          [ax + nx, ay + ny],
          [bx + nx, by + ny],
          [bx - nx, by - ny],
          [ax - nx, ay - ny],
        ]),
      ]);
    }
  }
  if (!shapes.length) return [];
  return polygonClipping.union(shapes[0], ...shapes.slice(1));
}

// Parallel lines at `spacing`, clipped to a multipolygon (even-odd scanline).
// Returns a flat [x1, y1, x2, y2, …] array.
function getClippedHatchLines(region, direction, spacing) {
  const { d, m } = getHatchAxes(direction);
  const edges = [];
  let min = Infinity;
  let max = -Infinity;
  for (const polygon of region) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const ca = a[0] * m[0] + a[1] * m[1];
        const cb = b[0] * m[0] + b[1] * m[1];
        edges.push([a, b, ca, cb]);
        min = Math.min(min, ca, cb);
        max = Math.max(max, ca, cb);
      }
    }
  }
  const segments = [];
  if (!edges.length) return segments;

  for (let k = Math.ceil(min / spacing); k * spacing <= max; k++) {
    const c = k * spacing;
    const crossings = [];
    for (const [a, b, ca, cb] of edges) {
      // Half-open rule: an edge lying on the line never counts, a vertex on
      // the line counts once.
      if (ca > c === cb > c) continue;
      const t = (c - ca) / (cb - ca);
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      crossings.push(x * d[0] + y * d[1]);
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const t0 = crossings[i];
      const t1 = crossings[i + 1];
      if (t1 - t0 < 1e-6) continue;
      segments.push(
        c * m[0] + t0 * d[0],
        c * m[1] + t0 * d[1],
        c * m[0] + t1 * d[0],
        c * m[1] + t1 * d[1]
      );
    }
  }
  return segments;
}

// loops: border loops of the face (contour + holes), each an array of [x, y].
// Returns { bandPolygons (polygon-clipping multipolygon), lineSegments (flat
// [x1, y1, x2, y2, …]) }, or null when the face is degenerate.
export default function getHatchFillGeometry({
  loops,
  direction = 1,
  bandWidth = HATCH_BAND_WIDTH_M,
  spacing = HATCH_SPACING_M,
}) {
  const validLoops = (loops || []).filter((loop) => loop?.length >= 3);
  if (!validLoops.length) return null;
  try {
    const face = getFaceRegion(validLoops);
    if (!face.length) return null;
    const buffer = getBorderBuffer(validLoops, bandWidth);
    const bandPolygons = polygonClipping.intersection(face, buffer);
    const interior = polygonClipping.difference(face, buffer);
    return {
      bandPolygons,
      lineSegments: getClippedHatchLines(interior, direction, spacing),
    };
  } catch (e) {
    // polygon-clipping can fail on degenerate rings: the caller keeps the
    // plain fill.
    console.warn("[getHatchFillGeometry] clipping failed", e);
    return null;
  }
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Is a point of the face on the drawn part of the hatched fill (band or
// line), or in a gap between two lines? `tolerance` (meters) widens the lines.
export function isPointOnHatchInk(
  point,
  {
    loops,
    direction = 1,
    bandWidth = HATCH_BAND_WIDTH_M,
    spacing = HATCH_SPACING_M,
  },
  tolerance = 0
) {
  const { m } = getHatchAxes(direction);
  const c = point.x * m[0] + point.y * m[1];
  if (Math.abs(c - Math.round(c / spacing) * spacing) <= tolerance) return true;

  for (const loop of loops || []) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      if (
        distanceToSegment(point.x, point.y, a[0], a[1], b[0], b[1]) <=
        bandWidth + tolerance
      ) {
        return true;
      }
    }
  }
  return false;
}
