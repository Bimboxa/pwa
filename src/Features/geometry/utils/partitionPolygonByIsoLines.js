import { Vector2, ShapeUtils } from "three";

// Partition a polygon by its iso-height chords (isoHeightLines whose endpoints
// lie on the outer contour) into regions, and triangulate each region so every
// chord is a REAL shared mesh edge — the top surface becomes adjacent planar
// (or ruled) strips folding exactly on the iso lines.
//
// Works purely on ring topology (no boolean clipping): each chord's endpoints
// are inserted as contour vertices, then the containing region's ring is split
// in two along the chord. Vertex OBJECTS are shared between sibling regions,
// so the final index-remap (by object identity) makes the fold edges
// watertight.
//
// Inputs (2D units of the caller — basemap-local for 3D, pixels for qties):
//   - contour: outer ring [{x, y, offsetBottom?, offsetTop?}, ...]
//     (arc-expanded; offsets in meters, already baked by
//     applyIsoHeightLinesToRings for non-iso vertices)
//   - holes: cut rings (same shape)
//   - isoChords: [{ polyline: [{x,y}, ...], height }] — height in meters
//     (offsetTop semantics)
//
// Returns { augContour, augHoles, extraPoints, tris } or null when the strict
// partition does not apply (endpoint off-contour or on a hole ring, crossing
// chords, chord through a hole, degenerate split...). `tris` index over
// [augContour, ...augHoles, ...extraPoints].flat — the exact flatPts layout
// used by triangulateAnnotationGeometry. On null the caller falls back to the
// interpolated-height triangulation (same sampler, seam exactness lost).
export default function partitionPolygonByIsoLines({
  contour,
  holes = [],
  isoChords = [],
}) {
  if (!Array.isArray(contour) || contour.length < 3) return null;

  const chordsIn = (isoChords || [])
    .map((c) => ({
      polyline: (c?.polyline || []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      ),
      height: Number(c?.height) || 0,
    }))
    .filter((c) => c.polyline.length >= 2);
  if (chordsIn.length === 0) return null;

  const validHoles = (holes || []).filter(
    (h) => Array.isArray(h) && h.length >= 3
  );

  // Tolerances relative to the polygon size: endpoints were projected onto
  // the contour at commit time, but the 3D ring may be arc-expanded with a
  // different sampling — allow a small slack.
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
  if (!Number.isFinite(diag) || diag < 1e-9) return null;
  const TOL_ENDPOINT = diag * 5e-3; // endpoint must lie on the contour
  const TOL_VERTEX = diag * 1e-3; // weld endpoint onto an existing vertex

  // --- 1. Insert chord endpoints as outer-ring vertices -------------------

  // Work on copies so the input rings are never mutated.
  const ringVerts = contour.map((p) => ({ ...p }));
  const n = ringVerts.length;
  // segIdx -> [{ t, vertex }] insertions on the ORIGINAL segment indices.
  const insertionsBySeg = new Map();

  const projectOnSegment = (p, a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-18) return null;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    return { t, x: px, y: py, distance: Math.hypot(p.x - px, p.y - py) };
  };

  // Nearest segment across outer ring + hole rings; ringIdx 0 = outer.
  const nearestOnRings = (p) => {
    let best = null;
    const scanRing = (ring, ringIdx) => {
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const proj = projectOnSegment(p, ring[i], ring[(i + 1) % m]);
        if (proj && (!best || proj.distance < best.distance)) {
          best = { ...proj, segIdx: i, ringIdx };
        }
      }
    };
    scanRing(ringVerts, 0);
    validHoles.forEach((h, hi) => scanRing(h, hi + 1));
    return best;
  };

  const attachEndpoint = (p, height) => {
    const best = nearestOnRings(p);
    if (!best || best.distance > TOL_ENDPOINT) return null;
    // V1: chords must end on the OUTER contour (hole-touching chords fall
    // back to the interpolated-height path).
    if (best.ringIdx !== 0) return null;

    const a = ringVerts[best.segIdx];
    const b = ringVerts[(best.segIdx + 1) % n];

    // Weld onto an existing original vertex when close enough.
    if (Math.hypot(best.x - a.x, best.y - a.y) <= TOL_VERTEX) {
      a.offsetTop = height;
      return a;
    }
    if (Math.hypot(best.x - b.x, best.y - b.y) <= TOL_VERTEX) {
      b.offsetTop = height;
      return b;
    }
    // Weld onto an already-inserted vertex (two chords sharing an endpoint).
    const list = insertionsBySeg.get(best.segIdx) || [];
    for (const ins of list) {
      if (
        Math.hypot(best.x - ins.vertex.x, best.y - ins.vertex.y) <= TOL_VERTEX
      ) {
        ins.vertex.offsetTop = height;
        return ins.vertex;
      }
    }
    const t = best.t;
    const vertex = {
      x: best.x,
      y: best.y,
      type: "square",
      offsetBottom:
        (a.offsetBottom ?? 0) +
        ((b.offsetBottom ?? 0) - (a.offsetBottom ?? 0)) * t,
      offsetTop: height,
    };
    list.push({ t, vertex });
    insertionsBySeg.set(best.segIdx, list);
    return vertex;
  };

  const chords = [];
  for (const c of chordsIn) {
    const first = c.polyline[0];
    const last = c.polyline[c.polyline.length - 1];
    const vA = attachEndpoint(first, c.height);
    const vB = attachEndpoint(last, c.height);
    if (!vA || !vB || vA === vB) return null;
    const interior = c.polyline.slice(1, -1).map((p) => ({
      x: p.x,
      y: p.y,
      type: "square",
      offsetBottom: 0,
      offsetTop: c.height,
    }));
    chords.push({ vA, vB, interior, height: c.height, polyline: c.polyline });
  }

  // Augmented outer ring: original vertices + sorted insertions per segment.
  const augContour = [];
  for (let i = 0; i < n; i++) {
    augContour.push(ringVerts[i]);
    const list = insertionsBySeg.get(i);
    if (list) {
      list.sort((u, v) => u.t - v.t);
      for (const ins of list) augContour.push(ins.vertex);
    }
  }

  // --- 2. Split regions along each chord ----------------------------------

  const signedArea = (ring) => {
    let s = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  };
  const AREA_EPS = diag * diag * 1e-8;
  const outerSign = Math.sign(signedArea(augContour));
  if (outerSign === 0) return null;

  const pointInRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
    return inside;
  };

  const sliceRing = (ring, from, to) => {
    const out = [];
    let i = from;
    for (;;) {
      out.push(ring[i]);
      if (i === to) break;
      i = (i + 1) % ring.length;
      if (out.length > ring.length) return null;
    }
    return out;
  };

  let regions = [{ ring: augContour }];
  for (const chord of chords) {
    const regionIdx = regions.findIndex(
      (r) => r.ring.includes(chord.vA) && r.ring.includes(chord.vB)
    );
    if (regionIdx < 0) return null; // crossing chords / inconsistent topology
    const ring = regions[regionIdx].ring;

    // Every chord-segment midpoint must sit strictly inside the region (and
    // outside every hole) — rejects chords sneaking outside or through holes.
    const path = [chord.vA, ...chord.interior, chord.vB];
    for (let i = 0; i < path.length - 1; i++) {
      const mid = {
        x: (path[i].x + path[i + 1].x) / 2,
        y: (path[i].y + path[i + 1].y) / 2,
      };
      if (!pointInRing(mid, ring)) return null;
      for (const h of validHoles) if (pointInRing(mid, h)) return null;
    }
    for (const v of chord.interior) {
      if (!pointInRing(v, ring)) return null;
      for (const h of validHoles) if (pointInRing(v, h)) return null;
    }

    const iA = ring.indexOf(chord.vA);
    const iB = ring.indexOf(chord.vB);
    const side1 = sliceRing(ring, iA, iB);
    const side2 = sliceRing(ring, iB, iA);
    if (!side1 || !side2) return null;
    const ring1 = [...side1, ...[...chord.interior].reverse()];
    const ring2 = [...side2, ...chord.interior];
    if (ring1.length < 3 || ring2.length < 3) return null;
    if (
      Math.abs(signedArea(ring1)) < AREA_EPS ||
      Math.abs(signedArea(ring2)) < AREA_EPS
    ) {
      return null;
    }
    regions.splice(regionIdx, 1, { ring: ring1 }, { ring: ring2 });
  }

  // --- 3. Assign holes to regions -----------------------------------------

  // Copy hole rings once so output objects are stable (identity-mapped).
  const augHoles = validHoles.map((h) => h.map((p) => ({ ...p })));
  const holesByRegion = regions.map(() => []);
  for (const hole of augHoles) {
    let assigned = -1;
    for (let ri = 0; ri < regions.length; ri++) {
      if (pointInRing(hole[0], regions[ri].ring)) {
        assigned = ri;
        break;
      }
    }
    if (assigned < 0) return null;
    // The whole hole must live in one region (no straddling).
    for (const p of hole) {
      if (!pointInRing(p, regions[assigned].ring)) return null;
    }
    holesByRegion[assigned].push(hole);
  }

  // --- 4. Triangulate each region, remap indices by object identity -------

  const flatIndex = new Map();
  const flatOrder = [];
  const idxOf = (v) => {
    let i = flatIndex.get(v);
    if (i === undefined) {
      i = flatOrder.length;
      flatIndex.set(v, i);
      flatOrder.push(v);
    }
    return i;
  };
  // Flat layout must be [augContour, ...augHoles, ...extraPoints] — the same
  // order triangulateAnnotationGeometry uses to build its vertex buffer.
  augContour.forEach(idxOf);
  augHoles.forEach((h) => h.forEach(idxOf));
  const extraStart = flatOrder.length;

  const tris = [];
  for (let ri = 0; ri < regions.length; ri++) {
    let ring = regions[ri].ring;
    const rHoles = holesByRegion[ri];
    // Keep triangle orientation consistent with the original contour winding
    // (earcut follows the input winding).
    if (Math.sign(signedArea(ring)) !== outerSign) {
      ring = [...ring].reverse();
    }
    const contourV2 = ring.map((p) => new Vector2(p.x, p.y));
    const holesV2 = rHoles.map((h) => h.map((p) => new Vector2(p.x, p.y)));
    let faces;
    try {
      faces = ShapeUtils.triangulateShape(contourV2, holesV2) || [];
    } catch {
      return null;
    }
    if (faces.length === 0) return null;
    const local = [...ring, ...rHoles.flat()];
    for (const [a, b, c] of faces) {
      tris.push([idxOf(local[a]), idxOf(local[b]), idxOf(local[c])]);
    }
  }

  const extraPoints = flatOrder.slice(extraStart);

  return { augContour, augHoles, extraPoints, tris };
}
