import polygonClipping from "polygon-clipping";

import {
  add,
  cross,
  dot,
  length,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";
import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

// Plane geometry of the painted parts of the « Pinceau » (MESH_BRUSH), in
// base-map-LOCAL meters (see meshPaintFrame.js):
//
//   LocalFace = { polygons: [{ contour: V[], holes: V[][] }], normal: V }
//     unit normal toward the painted side, contours CCW about it, holes CW.
//   Curved LocalFace = { polygons, normal, curved: true, angleDeg } — a
//     smooth surface: every polygon is ONE planar facet whose contour is CCW
//     about ITS painted side (the winding is the side, facet by facet);
//     `normal` is only indicative (area-weighted mean); angleDeg = the
//     smoothing angle the surface was grown with.
//   LocalEdge = { points: V[] } — 2 points (straight edge) or more (a planar
//     curve; closed: first point repeated), with `angleDeg` when curved.
//
// Pure (no three.js): node-testable, relative imports only.

const ZERO = { x: 0, y: 0, z: 0 };

// Below this a loop / face carries no area (m²) and an edge no length (m).
export const MIN_FACE_AREA_M2 = 1e-8;
export const MIN_EDGE_LENGTH_M = 1e-6;

// Plain {x, y, z} copy of a vector (three.js Vector3 accepted).
export const toV = (p) => ({ x: p.x, y: p.y, z: p.z });

const isFace = (partType) => partType === MESH_PAINT_PART_TYPES.FACE;

// --- loops ---

/**
 * Newell area vector of a closed planar loop (open: no closing duplicate):
 * direction = normal of the loop's counter-clockwise side, |v| = area (m²).
 * Robust to collinear runs and concave loops.
 */
export function loopAreaVector(loop) {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = loop?.length || 0;
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % n];
    x += (p.y - q.y) * (p.z + q.z);
    y += (p.z - q.z) * (p.x + q.x);
    z += (p.x - q.x) * (p.y + q.y);
  }
  return { x: x / 2, y: y / 2, z: z / 2 };
}

const getPolygons = (face) => face?.polygons || [];

// Every vertex of a part (faces: contours + holes; edges: points).
export function getPartPoints(partType, geometry) {
  if (!geometry) return [];
  if (!isFace(partType)) return geometry.points || [];
  const points = [];
  for (const polygon of getPolygons(geometry)) {
    for (const p of polygon.contour || []) points.push(p);
    for (const hole of polygon.holes || [])
      for (const p of hole) points.push(p);
  }
  return points;
}

/**
 * Unit normal of a face computed from its own loops (Newell): the area
 * vector of the largest contour (a sliver polygon must not decide). Null when
 * every contour is degenerate.
 */
export function getFaceNewellNormal(face) {
  let best = null;
  let bestArea = 0;
  for (const polygon of getPolygons(face)) {
    const v = loopAreaVector(polygon.contour || []);
    const area = length(v);
    if (area > bestArea) {
      bestArea = area;
      best = v;
    }
  }
  return best && bestArea > 0 ? normalize(best) : null;
}

export const isCurvedFace = (face) => Boolean(face?.curved);

// Unit normal of ONE polygon from its contour winding (null when degenerate).
export function getPolygonNormal(polygon) {
  const v = loopAreaVector(polygon?.contour || []);
  const area = length(v);
  return area > 0 ? scale(v, 1 / area) : null;
}

// Indicative normal of a curved face: the area-weighted mean of its facets'
// normals, or the largest facet's normal when they cancel out (a full turn).
function getCurvedFaceNormal(face) {
  let sum = { ...ZERO };
  let total = 0;
  for (const polygon of getPolygons(face)) {
    const v = loopAreaVector(polygon.contour || []);
    sum = add(sum, v);
    total += length(v);
  }
  if (total > 0 && length(sum) > 1e-3 * total) return normalize(sum);
  return getFaceNewellNormal(face);
}

// --- measures ---

/**
 * Net area (m²) of a face: Σ contour − holes, whatever the winding of the
 * loops (magnitudes only).
 */
export function faceArea(localFace) {
  let total = 0;
  for (const polygon of getPolygons(localFace)) {
    let area = length(loopAreaVector(polygon.contour || []));
    for (const hole of polygon.holes || []) {
      area -= length(loopAreaVector(hole));
    }
    total += Math.max(0, area);
  }
  return total;
}

// Length (m) of an edge (sum of its segments).
export function edgeLength(localEdge) {
  const points = localEdge?.points || [];
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    total += length(sub(points[i + 1], points[i]));
  }
  return total;
}

// --- plane basis ---

// Local frame is z-up: a face whose normal is within ~18° of ±z is
// "horizontal" and gets u along x.
const NEAR_VERTICAL_NORMAL_Z = 0.95;
const AXIS_X = { x: 1, y: 0, z: 0 };
const AXIS_Z = { x: 0, y: 0, z: 1 };

/**
 * Orthonormal right-handed basis of a plane: u × v = n, so a loop CCW about
 * `normal` has a positive 2D signed area. On a wall, v is the in-plane
 * vertical.
 * @returns {{origin: V, u: V, v: V, n: V}}
 */
export function computeFaceBasis(normal, origin = ZERO) {
  const n = normalize(normal || AXIS_Z);
  if (length(n) === 0) {
    return {
      origin: toV(origin),
      u: AXIS_X,
      v: { x: 0, y: 1, z: 0 },
      n: AXIS_Z,
    };
  }
  if (Math.abs(n.z) < NEAR_VERTICAL_NORMAL_Z) {
    const v = normalize(sub(AXIS_Z, scale(n, dot(AXIS_Z, n))));
    const u = cross(v, n);
    return { origin: toV(origin), u, v, n };
  }
  const u = normalize(sub(AXIS_X, scale(n, dot(AXIS_X, n))));
  const v = cross(n, u);
  return { origin: toV(origin), u, v, n };
}

export function projectPoint(point, basis) {
  const d = sub(point, basis.origin);
  return [dot(d, basis.u), dot(d, basis.v)];
}

export function unprojectPoint([x, y], basis) {
  return add(basis.origin, add(scale(basis.u, x), scale(basis.v, y)));
}

// --- 2D helpers ---

function signedArea2d(ring) {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = ring[i];
    const [qx, qy] = ring[(i + 1) % n];
    sum += px * qy - qx * py;
  }
  return sum / 2;
}

// Area of a polygon-clipping result (rings closed, outer ring first).
function multiPolygonArea(multiPolygon) {
  let total = 0;
  for (const polygon of multiPolygon || []) {
    if (!polygon?.length) continue;
    let area = Math.abs(signedArea2d(polygon[0].slice(0, -1)));
    for (const hole of polygon.slice(1)) {
      area -= Math.abs(signedArea2d(hole.slice(0, -1)));
    }
    total += Math.max(0, area);
  }
  return total;
}

function toClippingRing(loop, basis, grid) {
  const ring = [];
  for (const p of loop) {
    const [x, y] = projectPoint(p, basis);
    const sx = Math.round(x / grid) * grid;
    const sy = Math.round(y / grid) * grid;
    const last = ring[ring.length - 1];
    if (last && last[0] === sx && last[1] === sy) continue;
    ring.push([sx, sy]);
  }
  if (ring.length > 1) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) ring.pop();
  }
  if (ring.length < 3) return null;
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

function toClippingMultiPolygon(face, basis, grid) {
  const multiPolygon = [];
  for (const polygon of getPolygons(face)) {
    const outer = toClippingRing(polygon.contour || [], basis, grid);
    if (!outer) continue;
    const holes = (polygon.holes || [])
      .map((hole) => toClippingRing(hole, basis, grid))
      .filter(Boolean);
    multiPolygon.push([outer, ...holes]);
  }
  return multiPolygon;
}

// Successive snap grids (m) of the 2D boolean: polygon-clipping can choke on
// near-coincident edges; a coarser snap usually unblocks it.
const OVERLAP_SNAP_GRIDS = [1e-6, 1e-5];

/**
 * Area (m²) of the intersection of two faces: B is projected onto the plane
 * of A (A's basis), so two parallel faces a few mm apart still overlap.
 * Winding-agnostic. 0 when either face is degenerate (or the boolean fails).
 */
export function faceOverlapArea(faceA, faceB) {
  const normal = faceA?.normal ? normalize(faceA.normal) : null;
  const n = normal && length(normal) > 0 ? normal : getFaceNewellNormal(faceA);
  const origin = getPolygons(faceA)[0]?.contour?.[0];
  if (!n || !origin) return 0;
  const basis = computeFaceBasis(n, origin);
  for (const grid of OVERLAP_SNAP_GRIDS) {
    const a = toClippingMultiPolygon(faceA, basis, grid);
    const b = toClippingMultiPolygon(faceB, basis, grid);
    if (!a.length || !b.length) return 0;
    try {
      return multiPolygonArea(polygonClipping.intersection(a, b));
    } catch {
      // retry with the next (coarser) snap grid
    }
  }
  return 0;
}

// Facets of a face (planar: its polygons share the face normal; curved: one
// normal per polygon), with their boxes — the unit of the facet-wise overlap.
function getFacets(face) {
  const curved = isCurvedFace(face);
  const shared =
    !curved && face?.normal && length(face.normal) > 0
      ? normalize(face.normal)
      : null;
  const facets = [];
  for (const polygon of getPolygons(face)) {
    const normal = shared || getPolygonNormal(polygon);
    if (!normal || !(polygon.contour?.length >= 3)) continue;
    const local = { polygons: [polygon], normal };
    facets.push({
      local,
      normal,
      origin: polygon.contour[0],
      box: localGeometryBox(MESH_PAINT_PART_TYPES.FACE, local),
    });
  }
  return facets;
}

/**
 * Area (m²) two faces share, facet by facet — for curved faces (a planar
 * face is one facet per polygon): the overlaps of every pair of facets on
 * the same side (normals within `cosMin`, signed) and the same plane (gap ≤
 * `maxGap`) are added up.
 */
export function faceOverlapAreaByFacet(faceA, faceB, { cosMin, maxGap }) {
  const facetsA = getFacets(faceA);
  const facetsB = getFacets(faceB);
  let total = 0;
  for (const a of facetsA) {
    for (const b of facetsB) {
      if (dot(a.normal, b.normal) <= cosMin) continue;
      if (
        a.box.min.x - maxGap > b.box.max.x ||
        b.box.min.x - maxGap > a.box.max.x ||
        a.box.min.y - maxGap > b.box.max.y ||
        b.box.min.y - maxGap > a.box.max.y ||
        a.box.min.z - maxGap > b.box.max.z ||
        b.box.min.z - maxGap > a.box.max.z
      ) {
        continue;
      }
      if (Math.abs(dot(a.normal, sub(b.origin, a.origin))) > maxGap) continue;
      total += faceOverlapArea(a.local, b.local);
    }
  }
  return total;
}

// 2D shoelace centroid of an open ring of [x, y] (null when degenerate).
function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = ring[i];
    const [qx, qy] = ring[(i + 1) % n];
    const w = px * qy - qx * py;
    area += w;
    cx += (px + qx) * w;
    cy += (py + qy) * w;
  }
  if (Math.abs(area) < 1e-18) return null;
  return { area: Math.abs(area / 2), x: cx / (3 * area), y: cy / (3 * area) };
}

/**
 * Area centroid of a face (holes subtracted), on its plane. Falls back to the
 * vertex average for a degenerate face. Note: the centroid of a ring or of a
 * U lies off the material.
 */
export function faceCentroid(localFace) {
  const points = getPartPoints(MESH_PAINT_PART_TYPES.FACE, localFace);
  if (!points.length) return { ...ZERO };
  if (isCurvedFace(localFace)) {
    let total = 0;
    let sum = { ...ZERO };
    for (const polygon of getPolygons(localFace)) {
      const normal = getPolygonNormal(polygon);
      if (!normal) continue;
      const facet = { polygons: [polygon], normal };
      const area = faceArea(facet);
      total += area;
      sum = add(sum, scale(faceCentroid(facet), area));
    }
    if (total > MIN_FACE_AREA_M2) return scale(sum, 1 / total);
    return scale(
      points.reduce((acc, p) => add(acc, p), { ...ZERO }),
      1 / points.length
    );
  }
  const n = localFace?.normal
    ? normalize(localFace.normal)
    : getFaceNewellNormal(localFace);
  if (n && length(n) > 0) {
    const basis = computeFaceBasis(n, points[0]);
    let area = 0;
    let sx = 0;
    let sy = 0;
    for (const polygon of getPolygons(localFace)) {
      const outer = ringCentroid(
        (polygon.contour || []).map((p) => projectPoint(p, basis))
      );
      if (!outer) continue;
      area += outer.area;
      sx += outer.x * outer.area;
      sy += outer.y * outer.area;
      for (const hole of polygon.holes || []) {
        const inner = ringCentroid(hole.map((p) => projectPoint(p, basis)));
        if (!inner) continue;
        area -= inner.area;
        sx -= inner.x * inner.area;
        sy -= inner.y * inner.area;
      }
    }
    if (area > MIN_FACE_AREA_M2)
      return unprojectPoint([sx / area, sy / area], basis);
  }
  const sum = points.reduce((acc, p) => add(acc, p), { ...ZERO });
  return scale(sum, 1 / points.length);
}

// Axis-aligned bounding box {min, max} of a local part (null when empty).
export function localGeometryBox(partType, localGeometry) {
  const points = getPartPoints(partType, localGeometry);
  if (!points.length) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    if (p.x < min.x) min.x = p.x;
    if (p.y < min.y) min.y = p.y;
    if (p.z < min.z) min.z = p.z;
    if (p.x > max.x) max.x = p.x;
    if (p.y > max.y) max.y = p.y;
    if (p.z > max.z) max.z = p.z;
  }
  return { min, max };
}

// --- orientation ---

/**
 * Copy of a face with a unit normal and its loops wound about it: contours
 * CCW, holes CW. The normal is kept (only normalized); without a usable
 * normal, the Newell normal of the loops is adopted.
 */
export function orientFaceLoops(localFace) {
  if (isCurvedFace(localFace)) {
    // The contour winding of each facet IS its side: only the holes are
    // re-wound (CW about their facet).
    const polygons = [];
    for (const polygon of getPolygons(localFace)) {
      const contour = (polygon.contour || []).map(toV);
      const normal = getPolygonNormal({ contour });
      if (!normal) continue;
      const holes = (polygon.holes || []).map((hole) => hole.map(toV));
      for (const hole of holes) {
        if (dot(loopAreaVector(hole), normal) > 0) hole.reverse();
      }
      polygons.push({ contour, holes });
    }
    const curved = { polygons, curved: true };
    const normal = getCurvedFaceNormal(curved) || AXIS_Z;
    return Number.isFinite(localFace.angleDeg)
      ? { ...curved, normal, angleDeg: localFace.angleDeg }
      : { ...curved, normal };
  }
  let n = localFace?.normal ? normalize(localFace.normal) : null;
  if (!n || length(n) === 0) n = getFaceNewellNormal(localFace) || AXIS_Z;
  return {
    polygons: getPolygons(localFace).map((polygon) => {
      const contour = (polygon.contour || []).map(toV);
      const holes = (polygon.holes || []).map((hole) => hole.map(toV));
      if (dot(loopAreaVector(contour), n) < 0) contour.reverse();
      for (const hole of holes) {
        if (dot(loopAreaVector(hole), n) > 0) hole.reverse();
      }
      return { contour, holes };
    }),
    normal: n,
  };
}

// The other side of a face: normal negated, loops re-wound about it.
export function flipFace(localFace) {
  if (isCurvedFace(localFace)) {
    return orientFaceLoops({
      ...localFace,
      polygons: getPolygons(localFace).map((polygon) => ({
        contour: [...(polygon.contour || [])].reverse(),
        holes: polygon.holes || [],
      })),
    });
  }
  const n = localFace?.normal ? normalize(localFace.normal) : null;
  const base =
    n && length(n) > 0 ? n : getFaceNewellNormal(localFace) || AXIS_Z;
  return orientFaceLoops({
    polygons: getPolygons(localFace),
    // `|| 0`: no -0 components in stored normals.
    normal: { x: -base.x || 0, y: -base.y || 0, z: -base.z || 0 },
  });
}

// --- comparison ---

function maxNearestDistance(from, to) {
  let max = 0;
  for (const p of from) {
    let best = Infinity;
    for (const q of to) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dz = p.z - q.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
    }
    if (best > max) max = best;
  }
  return Math.sqrt(max);
}

/**
 * How far (m) geometry B moved from geometry A: symmetric max of the
 * nearest-vertex distances. Infinity when the two are structurally different
 * (polygon / hole / point counts, or a face that changed side).
 */
export function maxVertexShift(partType, geomA, geomB) {
  if (!geomA || !geomB) return Infinity;
  if (isFace(partType)) {
    const polygonsA = getPolygons(geomA);
    const polygonsB = getPolygons(geomB);
    if (polygonsA.length !== polygonsB.length) return Infinity;
    const holeCount = (polygons) =>
      polygons
        .map((polygon) => (polygon.holes || []).length)
        .sort((a, b) => a - b)
        .join(",");
    if (holeCount(polygonsA) !== holeCount(polygonsB)) return Infinity;
    if (isCurvedFace(geomA) !== isCurvedFace(geomB)) return Infinity;
    if (
      !isCurvedFace(geomA) &&
      geomA.normal &&
      geomB.normal &&
      dot(geomA.normal, geomB.normal) <= 0
    ) {
      return Infinity;
    }
  } else if ((geomA.points || []).length !== (geomB.points || []).length) {
    return Infinity;
  }
  const pointsA = getPartPoints(partType, geomA);
  const pointsB = getPartPoints(partType, geomB);
  if (!pointsA.length || !pointsB.length) return Infinity;
  return Math.max(
    maxNearestDistance(pointsA, pointsB),
    maxNearestDistance(pointsB, pointsA)
  );
}
