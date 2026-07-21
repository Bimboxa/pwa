import { Vector2, ShapeUtils } from "three";

// Partition a polygon by chord polylines whose endpoints lie on the outer
// contour, and triangulate each region so every chord is a REAL shared mesh
// edge — the top surface becomes adjacent planar (or ruled) strips folding
// exactly on the chords.
//
// Generalization of the historical iso-height partition
// (partitionPolygonByIsoLines, now an adapter over this): chords carry a
// PER-VERTEX height instead of one constant height, and chords may CROSS —
// crossing chords must share their junction vertex OBJECTS (see
// prepareShellProfiles), which get placed by the first chord processed and
// reused as sub-chord endpoints by the later ones.
//
// Works purely on ring topology (no boolean clipping): each chord's endpoints
// are inserted as contour vertices, then the containing region's ring is split
// along the chord (or along each of its sub-chords between already-placed
// junction vertices). Vertex OBJECTS are shared between sibling regions, so
// the final index-remap (by object identity) makes the fold edges watertight.
//
// Inputs (2D units of the caller — basemap-local for 3D, pixels for qties):
//   - contour: outer ring [{x, y, offsetBottom?, offsetTop?}, ...]
//   - holes: cut rings (same shape)
//   - chords: [{ polyline: [{x, y, height}, ...], inheritEndpoints }]
//       height in meters (offsetTop semantics).
//       inheritEndpoints=false (iso lines): contour vertices welded/inserted
//         at the endpoints get offsetTop = the endpoint's height (iso lines
//         PIN the contour).
//       inheritEndpoints=true (shell profiles): welded vertices keep their
//         own offsets; inserted vertices interpolate offsetBottom AND
//         offsetTop from the segment ends (profiles INHERIT the contour).
//
// Returns { augContour, augHoles, extraPoints, tris } or null when the strict
// partition does not apply (endpoint off-contour or on a hole ring,
// inconsistent crossings, chord through a hole, degenerate split...). `tris`
// index over [augContour, ...augHoles, ...extraPoints].flat — the exact
// flatPts layout used by triangulateAnnotationGeometry. On null the caller
// falls back to the interpolated-height triangulation.
export default function partitionPolygonByChords({
  contour,
  holes = [],
  chords = [],
}) {
  if (!Array.isArray(contour) || contour.length < 3) return null;

  const chordsIn = (chords || [])
    .map((c) => ({
      polyline: (c?.polyline || []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      ),
      inheritEndpoints: c?.inheritEndpoints === true,
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

  const attachEndpoint = (p, height, inherit) => {
    const best = nearestOnRings(p);
    if (!best || best.distance > TOL_ENDPOINT) return null;
    // V1: chords must end on the OUTER contour (hole-touching chords fall
    // back to the interpolated-height path).
    if (best.ringIdx !== 0) return null;

    const a = ringVerts[best.segIdx];
    const b = ringVerts[(best.segIdx + 1) % n];

    // Weld onto an existing original vertex when close enough. Iso chords
    // pin the vertex to the chord height; shell profiles inherit its offsets.
    if (Math.hypot(best.x - a.x, best.y - a.y) <= TOL_VERTEX) {
      if (!inherit) a.offsetTop = height;
      return a;
    }
    if (Math.hypot(best.x - b.x, best.y - b.y) <= TOL_VERTEX) {
      if (!inherit) b.offsetTop = height;
      return b;
    }
    // Weld onto an already-inserted vertex (two chords sharing an endpoint).
    const list = insertionsBySeg.get(best.segIdx) || [];
    for (const ins of list) {
      if (
        Math.hypot(best.x - ins.vertex.x, best.y - ins.vertex.y) <= TOL_VERTEX
      ) {
        if (!inherit) ins.vertex.offsetTop = height;
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
      offsetTop: inherit
        ? (a.offsetTop ?? 0) + ((b.offsetTop ?? 0) - (a.offsetTop ?? 0)) * t
        : height,
    };
    list.push({ t, vertex });
    insertionsBySeg.set(best.segIdx, list);
    return vertex;
  };

  // Interior chord vertices become mesh vertices carrying the chord height as
  // offsetTop. The input->mesh map keeps SHARED input objects (junctions of
  // crossing chords) mapped to ONE shared mesh vertex.
  const meshVertexByInput = new Map();
  const toMeshVertex = (p) => {
    let v = meshVertexByInput.get(p);
    if (!v) {
      v = {
        x: p.x,
        y: p.y,
        type: "square",
        offsetBottom: 0,
        offsetTop: Number(p.height) || 0,
      };
      meshVertexByInput.set(p, v);
    }
    return v;
  };

  const chordPaths = [];
  for (const c of chordsIn) {
    const first = c.polyline[0];
    const last = c.polyline[c.polyline.length - 1];
    const vA = attachEndpoint(
      first,
      Number(first.height) || 0,
      c.inheritEndpoints
    );
    const vB = attachEndpoint(
      last,
      Number(last.height) || 0,
      c.inheritEndpoints
    );
    if (!vA || !vB || vA === vB) return null;
    const interior = c.polyline.slice(1, -1).map(toMeshVertex);
    chordPaths.push({ path: [vA, ...interior, vB] });
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

  // Vertices already placed in some region ring. A chord crossing an earlier
  // chord meets it at a SHARED junction vertex that is already placed — the
  // chord is then split into sub-chords at those junctions, each splitting
  // one region on its own. Processing in input order suffices: a junction
  // between chords i < j is placed when i is processed (it sits on i's path),
  // before j needs it as a sub-chord endpoint.
  const placed = new Set(augContour);

  let regions = [{ ring: augContour }];
  for (const { path } of chordPaths) {
    // Split the path at already-placed interior vertices (junctions).
    const nodeIdx = [0];
    for (let i = 1; i < path.length - 1; i++) {
      if (placed.has(path[i])) nodeIdx.push(i);
    }
    nodeIdx.push(path.length - 1);

    for (let k = 0; k < nodeIdx.length - 1; k++) {
      const sub = path.slice(nodeIdx[k], nodeIdx[k + 1] + 1);
      const e0 = sub[0];
      const e1 = sub[sub.length - 1];
      const interior = sub.slice(1, -1);
      if (e0 === e1) return null;

      const regionIdx = regions.findIndex(
        (r) => r.ring.includes(e0) && r.ring.includes(e1)
      );
      if (regionIdx < 0) return null; // inconsistent topology
      const ring = regions[regionIdx].ring;

      // Every sub-chord-segment midpoint must sit strictly inside the region
      // (and outside every hole) — rejects chords sneaking outside or through
      // holes.
      for (let i = 0; i < sub.length - 1; i++) {
        const mid = {
          x: (sub[i].x + sub[i + 1].x) / 2,
          y: (sub[i].y + sub[i + 1].y) / 2,
        };
        if (!pointInRing(mid, ring)) return null;
        for (const h of validHoles) if (pointInRing(mid, h)) return null;
      }
      for (const v of interior) {
        if (!pointInRing(v, ring)) return null;
        for (const h of validHoles) if (pointInRing(v, h)) return null;
      }

      const iA = ring.indexOf(e0);
      const iB = ring.indexOf(e1);
      const side1 = sliceRing(ring, iA, iB);
      const side2 = sliceRing(ring, iB, iA);
      if (!side1 || !side2) return null;
      const ring1 = [...side1, ...[...interior].reverse()];
      const ring2 = [...side2, ...interior];
      if (ring1.length < 3 || ring2.length < 3) return null;
      if (
        Math.abs(signedArea(ring1)) < AREA_EPS ||
        Math.abs(signedArea(ring2)) < AREA_EPS
      ) {
        return null;
      }
      regions.splice(regionIdx, 1, { ring: ring1 }, { ring: ring2 });
      for (const v of interior) placed.add(v);
    }
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
