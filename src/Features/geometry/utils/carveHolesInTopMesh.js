import { Vector2, ShapeUtils } from "three";
import polygonClipping from "polygon-clipping";

// Carve hole rings (POLYGON cuts) into an already-built top surface WITHOUT
// holes: "the shape without holes, holes punched afterwards".
//
// Why: a surface folded on chords (isoHeightLines) has no height function to
// evaluate at a cut vertex, and the strict chord partition rejects any hole
// crossed by a chord or straddling two strips. Here the no-hole surface is the
// reference: every triangle is clipped in 2D by the holes and re-triangulated
// IN ITS OWN PLANE, so the sloped faces are kept as they are and the vertical
// projection of the opening is exactly the drawn cut.
//
// Inputs (any consistent 2D unit, offsets in meters):
//   - contour: outer ring of the no-hole surface
//   - extraPoints: interior vertices of the no-hole surface
//   - tris: [[a, b, c], ...] indexing [contour, ...extraPoints]
//   - holes: cut rings [{x, y}, ...] — their own offsets are ignored
//
// Returns { augHoles, extraPoints, tris } or null when nothing can be carved:
//   - augHoles: the hole rings with a vertex inserted at every crossing with a
//     mesh edge (so each rim segment lies on ONE face) and offsetBottom /
//     offsetTop sampled on the surface — the hole walls reach the sheet.
//   - extraPoints: input extraPoints + the vertices created by the clipping.
//   - tris: index over [contour, ...augHoles, ...extraPoints] — the flatPts
//     layout of triangulateAnnotationGeometry.

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function baryWeights(p, a, b, c) {
  const area2 = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area2) < 1e-18) return null;
  const wa = ((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y)) / area2;
  const wb = ((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y)) / area2;
  return [wa, wb, 1 - wa - wb];
}

// Sampler of the surface offsets at a 2D position: barycentric interpolation
// in the containing triangle (offsetBottom and offsetTop separately — linear,
// so their sum stays on the top sheet). A position outside every triangle
// takes the closest one: weights clamped by default, or — `extrapolate` — the
// plane of that triangle extended. Returns null when the mesh has no usable
// triangle.
export function createTopSurfaceSampler({ flatPts, tris, extrapolate = false }) {
  const faces = (tris || [])
    .map(([ia, ib, ic]) => [flatPts[ia], flatPts[ib], flatPts[ic]])
    .filter(([a, b, c]) => a && b && c);
  if (faces.length === 0) return null;

  return (p) => {
    let best = null;
    for (const [a, b, c] of faces) {
      const w = baryWeights(p, a, b, c);
      if (!w) continue;
      const minW = Math.min(w[0], w[1], w[2]);
      if (!best || minW > best.minW) best = { minW, w, a, b, c };
      if (minW >= -1e-9) break;
    }
    if (!best) return null;
    let [wa, wb, wc] = best.w;
    if (!extrapolate) {
      [wa, wb, wc] = best.w.map((v) => Math.max(0, v));
      const sum = wa + wb + wc || 1;
      wa /= sum;
      wb /= sum;
      wc /= sum;
    }
    const lerp = (key) =>
      wa * num(best.a[key]) + wb * num(best.b[key]) + wc * num(best.c[key]);
    return { offsetBottom: lerp("offsetBottom"), offsetTop: lerp("offsetTop") };
  };
}

function ringBbox(ring) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function bboxOverlap(a, b, pad) {
  return !(
    a.maxX < b.minX - pad ||
    b.maxX < a.minX - pad ||
    a.maxY < b.minY - pad ||
    b.maxY < a.minY - pad
  );
}

export default function carveHolesInTopMesh({
  contour,
  extraPoints = [],
  tris,
  holes,
}) {
  const rings = (holes || []).filter((h) => Array.isArray(h) && h.length >= 3);
  if (rings.length === 0) return null;
  if (!Array.isArray(contour) || contour.length < 3) return null;
  if (!Array.isArray(tris) || tris.length === 0) return null;

  const solidPts = [...contour, ...extraPoints];
  const sample = createTopSurfaceSampler({ flatPts: solidPts, tris });
  if (!sample) return null;

  const box = ringBbox(solidPts);
  const diag = Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
  if (!Number.isFinite(diag) || diag < 1e-9) return null;
  const QUANTUM = diag * 1e-8; // vertex weld grid
  const T_EPS = 1e-9;

  // --- 1. Hole rims: insert a vertex at every crossing with a mesh edge ----

  const meshEdges = [];
  const seenEdges = new Set();
  for (const [a, b, c] of tris) {
    for (const [i, j] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      meshEdges.push([solidPts[i], solidPts[j]]);
    }
  }

  const crossingParams = (a, b) => {
    const ts = [];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    for (const [c, d] of meshEdges) {
      const ex = d.x - c.x;
      const ey = d.y - c.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-18) continue;
      const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / den;
      const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / den;
      if (t <= T_EPS || t >= 1 - T_EPS || u < -T_EPS || u > 1 + T_EPS) continue;
      ts.push(t);
    }
    ts.sort((p, q) => p - q);
    return ts.filter((t, i) => i === 0 || t - ts[i - 1] > 1e-7);
  };

  const augHoles = rings.map((ring) => {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      out.push({ ...a, ...sample(a) });
      for (const t of crossingParams(a, b)) {
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        out.push({ ...p, type: "square", ...sample(p) });
      }
    }
    return out;
  });

  // --- 2. Vertex buffer [contour, ...augHoles, ...extraPoints(+new)] ------

  const nContour = contour.length;
  const holesFlat = augHoles.flat();
  const nHoles = holesFlat.length;
  const allExtras = [...extraPoints];
  const extraBase = nContour + nHoles;
  const remapSolid = (i) => (i < nContour ? i : i + nHoles);

  // Quantized weld map; neighbours are probed so two computations of the same
  // crossing falling on each side of a cell border still weld.
  const cellOf = (v) => Math.round(v / QUANTUM);
  const indexByCell = new Map();
  const register = (p, index) => {
    const key = `${cellOf(p.x)},${cellOf(p.y)}`;
    if (!indexByCell.has(key)) indexByCell.set(key, index);
  };
  contour.forEach((p, i) => register(p, i));
  holesFlat.forEach((p, i) => register(p, nContour + i));
  extraPoints.forEach((p, i) => register(p, extraBase + i));

  const findOrAdd = (x, y) => {
    const cx = cellOf(x);
    const cy = cellOf(y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const found = indexByCell.get(`${cx + dx},${cy + dy}`);
        if (found !== undefined) return found;
      }
    }
    const p = { x, y };
    const index = extraBase + allExtras.length;
    allExtras.push({ ...p, type: "square", ...sample(p) });
    indexByCell.set(`${cx},${cy}`, index);
    return index;
  };

  // --- 3. Clip every triangle by the holes, re-triangulate in its plane ---

  const holeBoxes = augHoles.map(ringBbox);
  const holePolys = augHoles.map((ring) => [
    [...ring.map((p) => [p.x, p.y]), [ring[0].x, ring[0].y]],
  ]);
  const AREA_EPS = diag * diag * 1e-14;
  const area2Of = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);

  const outTris = [];
  for (const [ia, ib, ic] of tris) {
    const a = solidPts[ia];
    const b = solidPts[ib];
    const c = solidPts[ic];
    const triBox = ringBbox([a, b, c]);
    const clips = holePolys.filter((_, hi) =>
      bboxOverlap(triBox, holeBoxes[hi], QUANTUM)
    );
    if (clips.length === 0) {
      outTris.push([remapSolid(ia), remapSolid(ib), remapSolid(ic)]);
      continue;
    }

    const triSign = Math.sign(
      area2Of([a.x, a.y], [b.x, b.y], [c.x, c.y])
    );
    if (triSign === 0) continue;

    let pieces;
    try {
      pieces = polygonClipping.difference(
        [
          [
            [a.x, a.y],
            [b.x, b.y],
            [c.x, c.y],
            [a.x, a.y],
          ],
        ],
        ...clips
      );
    } catch {
      return null;
    }

    for (const polygon of pieces) {
      // polygon-clipping rings are closed (first point repeated).
      const pieceRings = polygon
        .map((ring) => ring.slice(0, -1))
        .filter((ring) => ring.length >= 3);
      if (pieceRings.length === 0) continue;
      const [outer, ...inners] = pieceRings;
      let faces;
      try {
        faces =
          ShapeUtils.triangulateShape(
            outer.map(([x, y]) => new Vector2(x, y)),
            inners.map((ring) => ring.map(([x, y]) => new Vector2(x, y)))
          ) || [];
      } catch {
        return null;
      }
      const local = [outer, ...inners].flat();
      for (const [fa, fb, fc] of faces) {
        const pa = local[fa];
        const pb = local[fb];
        const pc = local[fc];
        const area2 = area2Of(pa, pb, pc);
        if (Math.abs(area2) < AREA_EPS) continue;
        const va = findOrAdd(pa[0], pa[1]);
        const vb = findOrAdd(pb[0], pb[1]);
        const vc = findOrAdd(pc[0], pc[1]);
        if (va === vb || vb === vc || va === vc) continue;
        // Keep the winding of the source triangle.
        outTris.push(
          Math.sign(area2) === triSign ? [va, vb, vc] : [va, vc, vb]
        );
      }
    }
  }

  if (outTris.length === 0) return null;

  return { augHoles, extraPoints: allExtras, tris: outTris };
}
