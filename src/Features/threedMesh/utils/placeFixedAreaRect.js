import pointInPolygon2d from "./pointInPolygon2d.js";
import {
  boundsOverlap,
  difference,
  intersection,
  multiPolygonArea,
  multiPolygonBounds,
  polygonArea,
  rectMultiPolygon,
} from "./polygonBoolean2d.js";
import { chordThroughPoint } from "./polygonChord2d.js";

// Slack of the "is this point strictly inside the kept quadrant" tests (m).
const EPS = 1e-7;

// Bisection steps of the net-area solve (2^-48 of the searched range).
const BISECTION_STEPS = 48;

// Axis-aligned rectangle of a given NET area, laid in the free region around
// the cursor (2D, in the frame of the user axes — the atlas of
// unfoldPiecesAcrossCreases).
//
// - border: MultiPolygon of the free region bounded by the BORDERS (face
//   edges, cut lines, existing mailles — computeFreePieces);
// - openings: MultiPolygon of the openings of the face. Not borders: the
//   rectangle spans them, and the target is the NET area (rectangle minus
//   the openings it covers);
// - cursor2d, targetArea (m²), snapToleranceM.
//
// 1. Host: the border polygon holding the cursor.
// 2. Cell: the box of the horizontal and vertical chords of the host through
//    the cursor, shrunk quadrant by quadrant until it lies inside the host
//    (an L-shaped face, an existing maille or a slanted edge in a corner).
// 3. Anchor: the corner of the cell nearest to the cursor — the rectangle
//    leans on the two nearest borders.
// 4. Size: a square while it fits; when the cell is too narrow (resp. low)
//    the rectangle takes the whole width (resp. height) and grows along the
//    other axis; when the whole cell is too small, the rectangle IS the cell
//    (`fits: false`).
// 5. Snap: a free edge closer than snapToleranceM to a vertex of the host
//    or of an opening moves onto it, the other side being solved again so
//    the area stays exact.
//
// Returns null (no host under the cursor, cursor in an opening, failed
// boolean) or { rect: { xMin, xMax, yMin, yMax }, width, height, area (net),
// grossArea, fits, cell, anchor: { x, y }, snapped }.
// Pure (no three.js), node-testable.
export default function placeFixedAreaRect({
  border,
  openings = [],
  cursor2d,
  targetArea,
  snapToleranceM = 0,
  minSide = 1e-3,
}) {
  if (!cursor2d || !(targetArea > 0)) return null;

  const host = (border || []).find((polygon) =>
    polygonContains(polygon, cursor2d)
  );
  if (!host) return null;
  if ((openings || []).some((polygon) => polygonContains(polygon, cursor2d)))
    return null;

  const hostLoops = host.map(ringToLoop);
  const chordH = chordThroughPoint(hostLoops, cursor2d, "H");
  const chordV = chordThroughPoint(hostLoops, cursor2d, "V");
  if (!chordH || !chordV) return null;

  const cell = shrinkCellToHost(
    { xMin: chordH.lo, xMax: chordH.hi, yMin: chordV.lo, yMax: chordV.hi },
    [host],
    cursor2d
  );
  if (!cell) return null;
  const w = cell.xMax - cell.xMin;
  const h = cell.yMax - cell.yMin;
  if (w < minSide || h < minSide) return null;

  // Anchor: the nearest corner of the cell.
  const left = cursor2d.x - cell.xMin <= cell.xMax - cursor2d.x;
  const bottom = cursor2d.y - cell.yMin <= cell.yMax - cursor2d.y;
  const anchor = {
    x: left ? cell.xMin : cell.xMax,
    y: bottom ? cell.yMin : cell.yMax,
  };
  const sx = left ? 1 : -1;
  const sy = bottom ? 1 : -1;
  const rectOf = (width, height) => ({
    xMin: Math.min(anchor.x, anchor.x + sx * width),
    xMax: Math.max(anchor.x, anchor.x + sx * width),
    yMin: Math.min(anchor.y, anchor.y + sy * height),
    yMax: Math.max(anchor.y, anchor.y + sy * height),
  });

  // Net area: the openings overlapping the cell are subtracted.
  const cellOpenings = (openings || []).filter((polygon) =>
    boundsOverlap(multiPolygonBounds([polygon]), cell)
  );
  let failed = false;
  const net = (width, height) => {
    const gross = width * height;
    if (!cellOpenings.length) return gross;
    const covered = intersection(
      rectMultiPolygon(rectOf(width, height)),
      cellOpenings
    );
    if (!covered) {
      failed = true;
      return gross;
    }
    return gross - multiPolygonArea(covered);
  };
  // Smallest t in [lo, hi] with f(t) >= targetArea (f non-decreasing).
  const solve = (f, lo, hi) => {
    if (!cellOpenings.length) return null;
    let a = lo;
    let b = hi;
    for (let i = 0; i < BISECTION_STEPS; i++) {
      const mid = (a + b) / 2;
      if (f(mid) >= targetArea) b = mid;
      else a = mid;
    }
    return b;
  };
  // The other side of a rectangle whose one side is fixed, null when the
  // cell is too short for the target.
  const heightFor = (width) => {
    if (net(width, h) < targetArea - 1e-12) return null;
    return solve((t) => net(width, t), 0, h) ?? targetArea / width;
  };
  const widthFor = (height) => {
    if (net(w, height) < targetArea - 1e-12) return null;
    return solve((t) => net(t, height), 0, w) ?? targetArea / height;
  };

  let width;
  let height;
  let fits = true;
  const side = Math.min(w, h);
  if (net(side, side) >= targetArea) {
    const s = solve((t) => net(t, t), 0, side) ?? Math.sqrt(targetArea);
    width = s;
    height = s;
  } else if (w <= h) {
    width = w;
    height = heightFor(w);
  } else {
    height = h;
    width = widthFor(h);
  }
  if (width == null || height == null) {
    width = w;
    height = h;
    fits = false;
  }
  if (failed) return null;

  // Snap of the free edges on the vertices of the host and of the openings.
  let snapped = false;
  if (fits && snapToleranceM > 0) {
    const xs = [];
    const ys = [];
    for (const polygon of [host, ...cellOpenings]) {
      for (const ring of polygon) {
        for (const [x, y] of ring) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    let best = null;
    const consider = (axis, candidate) => {
      const isX = axis === "x";
      const free = isX ? anchor.x + sx * width : anchor.y + sy * height;
      const distance = Math.abs(candidate - free);
      if (distance >= snapToleranceM || distance < 1e-9) return;
      if (best && distance >= best.distance) return;
      const length =
        (candidate - (isX ? anchor.x : anchor.y)) * (isX ? sx : sy);
      if (length < minSide || length > (isX ? w : h) + 1e-9) return;
      const other = isX ? heightFor(length) : widthFor(length);
      if (other == null || other < minSide) return;
      best = isX
        ? { distance, width: length, height: other }
        : { distance, width: other, height: length };
    };
    if (width < w - 1e-9) xs.forEach((x) => consider("x", x));
    if (height < h - 1e-9) ys.forEach((y) => consider("y", y));
    if (best && !failed) {
      width = best.width;
      height = best.height;
      snapped = true;
    }
  }
  if (failed) return null;

  return {
    rect: rectOf(width, height),
    width,
    height,
    area: net(width, height),
    grossArea: width * height,
    fits,
    cell,
    anchor,
    snapped,
  };
}

function ringToLoop(ring) {
  return ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));
}

// The point lies inside the polygon (rings: outer, then holes).
function polygonContains(polygon, point) {
  if (!polygon?.length) return false;
  if (!pointInPolygon2d(point, ringToLoop(polygon[0]))) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInPolygon2d(point, ringToLoop(polygon[i]))) return false;
  }
  return true;
}

// Largest-ish box inside `host` holding the cursor, from the box of its two
// chords. The chords are free, so whatever of the box lies outside the host
// (`bad`) sits in the open quadrants around the cursor. Quadrant by
// quadrant, the far corner of the quadrant is pulled in to a point q of the
// bad polygons' boundary — a vertex, a pure x / y cut at a vertex, or the
// best point of a slanted edge — such that no bad polygon enters the kept
// part, keeping the largest box. One pass is enough: shrinking never
// invalidates a quadrant already solved.
export function shrinkCellToHost(cell, host, cursor) {
  const box = { ...cell };
  const diag = Math.hypot(cell.xMax - cell.xMin, cell.yMax - cell.yMin);
  const minArea = Math.max(1e-10, diag * diag * 1e-9);

  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    // Extents of this quadrant and of the opposite sides, from the cursor.
    const extentX = sx > 0 ? box.xMax - cursor.x : cursor.x - box.xMin;
    const extentY = sy > 0 ? box.yMax - cursor.y : cursor.y - box.yMin;
    if (extentX < EPS || extentY < EPS) continue;
    const otherX = sx > 0 ? cursor.x - box.xMin : box.xMax - cursor.x;
    const otherY = sy > 0 ? cursor.y - box.yMin : box.yMax - cursor.y;

    const bad = difference(
      rectMultiPolygon({
        xMin: Math.min(cursor.x, cursor.x + sx * extentX),
        xMax: Math.max(cursor.x, cursor.x + sx * extentX),
        yMin: Math.min(cursor.y, cursor.y + sy * extentY),
        yMax: Math.max(cursor.y, cursor.y + sy * extentY),
      }),
      host
    );
    if (!bad) return null;
    // Outer rings of the bad polygons, in the quadrant's own coordinates
    // (the cursor at the origin, the quadrant along +x / +y).
    const rings = bad
      .filter((polygon) => polygonArea(polygon) > minArea)
      .map((polygon) =>
        polygon[0].slice(0, polygon[0].length - 1).map(([x, y]) => ({
          x: Math.min(extentX, Math.max(0, (x - cursor.x) * sx)),
          y: Math.min(extentY, Math.max(0, (y - cursor.y) * sy)),
        }))
      );
    if (!rings.length) continue;

    const candidates = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        candidates.push(
          { x: a.x, y: extentY },
          { x: extentX, y: a.y },
          { x: a.x, y: a.y }
        );
        // Slanted edge facing the cursor: the point keeping the largest box.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dy < 0) {
          const t =
            -((otherX + a.x) * dy + (otherY + a.y) * dx) / (2 * dx * dy);
          if (t > 0 && t < 1) {
            candidates.push({ x: a.x + t * dx, y: a.y + t * dy });
          }
        }
      }
    }

    let best = null;
    for (const q of candidates) {
      const area = (otherX + q.x) * (otherY + q.y);
      if (best && area <= best.area) continue;
      if (rings.some((ring) => ringEntersQuadrant(ring, q))) continue;
      best = { ...q, area };
    }
    if (!best) return null;
    if (sx > 0) box.xMax = cursor.x + best.x;
    else box.xMin = cursor.x - best.x;
    if (sy > 0) box.yMax = cursor.y + best.y;
    else box.yMin = cursor.y - best.y;
  }
  return box;
}

// A ring edge has a point with x < q.x and y < q.y (strictly, EPS slack).
function ringEntersQuadrant(ring, q) {
  const limitX = q.x - EPS;
  const limitY = q.y - EPS;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const rangeX = paramsBelow(a.x, b.x, limitX);
    if (!rangeX) continue;
    const rangeY = paramsBelow(a.y, b.y, limitY);
    if (!rangeY) continue;
    if (Math.max(rangeX[0], rangeY[0]) <= Math.min(rangeX[1], rangeY[1]))
      return true;
  }
  return false;
}

// Sub-interval [t0, t1] of [0, 1] where a + t (b − a) < limit, null if none.
function paramsBelow(a, b, limit) {
  const aBelow = a < limit;
  const bBelow = b < limit;
  if (aBelow && bBelow) return [0, 1];
  if (!aBelow && !bBelow) return null;
  const t = (limit - a) / (b - a);
  return aBelow ? [0, t] : [t, 1];
}
