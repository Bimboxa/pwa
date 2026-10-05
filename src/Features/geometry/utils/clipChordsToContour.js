// Clip chord polylines by the outer contour of a polygon.
//
// Why: a chord (isoHeightLine) is authored with both endpoints ON the contour.
// When the contour is notched afterwards ("Evider" carving the outer ring), a
// chord may run through the notch or end in the void — the strict partition
// (partitionPolygonByChords) then rejects it and the whole surface loses its
// folds. Clipping turns such a chord into the sub-chords that still lie inside
// the polygon, each ending exactly on the contour.
//
// Inputs (any consistent 2D unit):
//   - contour: outer ring [{x, y}, ...]
//   - chords: [{ polyline: [{x, y, height?}, ...], ...rest }]
//
// Returns a chords array. A chord that does not cross the contour (the normal
// case: endpoints on the contour within tolerance) is returned BY REFERENCE,
// and its interior vertex objects are always preserved (junction identity of
// crossing chords). Crossing points are new vertices whose `height` is lerped
// along the crossed segment.
export default function clipChordsToContour({ contour, chords = [] }) {
  if (!Array.isArray(contour) || contour.length < 3) return chords;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of contour) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (!Number.isFinite(diag) || diag < 1e-9) return chords;
  // Crossings closer than this to a chord extremity are the extremity itself
  // sitting on the contour (same slack as the partition's vertex weld).
  const TOL = diag * 1e-3;

  const n = contour.length;

  const pointInContour = (p) => {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = contour[i];
      const b = contour[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Parameters t in [0, 1] along a→b where the segment crosses the contour.
  const crossingsOnSegment = (a, b) => {
    const ts = [];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    for (let i = 0; i < n; i++) {
      const c = contour[i];
      const d = contour[(i + 1) % n];
      const ex = d.x - c.x;
      const ey = d.y - c.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-18) continue; // parallel
      const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / den;
      const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      ts.push(t);
    }
    return ts.sort((p, q) => p - q);
  };

  const out = [];
  let changed = false;

  for (const chord of chords) {
    const polyline = chord?.polyline || [];
    if (polyline.length < 2) {
      out.push(chord);
      continue;
    }
    const first = polyline[0];
    const last = polyline[polyline.length - 1];

    // Path = original vertices + crossing vertices (flagged as cut nodes).
    const path = [{ point: first, isCut: false }];
    let hasCut = false;
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i];
      const b = polyline[i + 1];
      for (const t of crossingsOnSegment(a, b)) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (
          Math.hypot(x - first.x, y - first.y) <= TOL ||
          Math.hypot(x - last.x, y - last.y) <= TOL
        ) {
          continue;
        }
        const prev = path[path.length - 1];
        if (prev.isCut && Math.hypot(x - prev.point.x, y - prev.point.y) <= TOL) {
          continue; // same crossing seen on two contour edges (vertex hit)
        }
        const point = { x, y };
        if (a.height != null || b.height != null) {
          const ha = Number(a.height) || 0;
          const hb = Number(b.height) || 0;
          point.height = ha + (hb - ha) * t;
        }
        path.push({ point, isCut: true });
        hasCut = true;
      }
      path.push({ point: b, isCut: false });
    }

    if (!hasCut) {
      out.push(chord);
      continue;
    }
    changed = true;

    // Split at the cut nodes, keep the pieces lying inside the contour.
    let piece = [path[0].point];
    const flush = () => {
      if (piece.length >= 2) {
        let length = 0;
        let inside = true;
        for (let i = 0; i < piece.length - 1; i++) {
          const a = piece[i];
          const b = piece[i + 1];
          length += Math.hypot(b.x - a.x, b.y - a.y);
          if (!pointInContour({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) {
            inside = false;
            break;
          }
        }
        if (inside && length > TOL) out.push({ ...chord, polyline: piece });
      }
    };
    for (let i = 1; i < path.length; i++) {
      piece.push(path[i].point);
      if (path[i].isCut) {
        flush();
        piece = [path[i].point];
      }
    }
    flush();
  }

  return changed ? out : chords;
}
