import { CUT_LINE_GAP_TOLERANCE_M } from "../../threedCutLines/utils/extendCutLine.js";

import computePlaneBasis from "./computePlaneBasis.js";
import pointInPolygon2d from "./pointInPolygon2d.js";
import { projectLoopTo2d, projectPointTo2d } from "./planeProjection.js";
import { dot, normalize, sub } from "./vec3Utils.js";

// Groups of mailles to merge for « Fusionner les mailles adjacentes »: two
// mailles belong to the same group when they touch along a stretch that no
// cut line separates. Pure (no three.js, no DB), world coordinates.
//
// Contact: a border edge of one maille runs ON the other maille — along one
// of its borders, or across one of its planar faces (a wall standing in the
// middle of a floor). The interior of a curved (shell) maille is not tested:
// a shell only touches by its borders.
//
// Separation: the stretch of the contact lying on a cut line does not count.
// A line that leaves a plane (it climbs a wall standing on the face) cuts
// that face up to its boundary (clipFaceByCutLines prolongs the run): for
// the borders of a planar face, the prolongation of every run of the face
// plane separates too — as an unbounded ray, the original face being unknown
// here.
//
// The contact is measured by sampling the border edges: the mailles are
// joined when a run of consecutive free samples (on the other maille, off
// every cut line) is at least `minSharedLength` long.

// Mailles are built on the DISPLAYED faces of the annotations, which are
// shrunk by up to 15 mm (10 mm lateral, 5 mm top): two mailles of two
// touching annotations sit that far apart.
export const ADJACENT_CONTACT_TOL_M = 0.02;
export const ADJACENT_MIN_SHARED_M = 0.05;
const SAMPLE_STEP_M = 0.01;
const MAX_SAMPLES_PER_EDGE = 4000;
// Same as clipFaceByCutLines: a line point this close to a plane lies on it.
const PLANE_TOL_M = 1e-2;

/**
 * @param {object[]} rows - maille records ({ id, faces, shell })
 * @param {[[{x,y,z}]]} cutLines - world polylines of the visible cut lines
 * @returns {object[][]} groups of 2+ rows (rows keep their input order)
 */
export default function groupAdjacentMeshes3d(
  rows,
  cutLines,
  {
    tolerance = ADJACENT_CONTACT_TOL_M,
    minSharedLength = ADJACENT_MIN_SHARED_M,
  } = {}
) {
  const lines = (cutLines || [])
    .map((line) => (line || []).filter(isFinitePoint))
    .filter((line) => line.length >= 2)
    .map((points) => ({
      points,
      box: expandBox(boxOfPoints(points), tolerance),
    }));

  const items = (rows || [])
    .map((row) => prepareMaille(row, lines, tolerance))
    .filter(Boolean);

  // Union-find over the items.
  const parent = items.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  const ctx = { lines, tolerance, minSharedLength };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (find(i) === find(j)) continue;
      if (!boxesOverlap(items[i].box, items[j].box)) continue;
      if (
        hasFreeContact(items[i], items[j], ctx) ||
        hasFreeContact(items[j], items[i], ctx)
      ) {
        parent[find(j)] = find(i);
      }
    }
  }

  const groupsByRoot = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
    groupsByRoot.get(root).push(item.row);
  });
  return [...groupsByRoot.values()].filter((group) => group.length >= 2);
}

// --- preparation ---

function prepareMaille(row, lines, tolerance) {
  const edges = [];
  const faces = [];
  const points = [];

  const addLoop = (loop, rays) => {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      edges.push({ a, b, rays });
      points.push(a);
    }
  };

  for (const face of row?.faces || []) {
    const contour = (face?.contour || []).filter(isFinitePoint);
    if (contour.length < 3 || !face.normal) continue;
    const holes = (face.holes || [])
      .map((hole) => (hole || []).filter(isFinitePoint))
      .filter((hole) => hole.length >= 3);
    const basis = computePlaneBasis(face.normal, contour[0]);
    const rays = getPlaneSeparatorRays(basis, lines);
    faces.push({
      basis,
      contour2d: projectLoopTo2d(contour, basis),
      holes2d: holes.map((hole) => projectLoopTo2d(hole, basis)),
    });
    addLoop(contour, rays);
    holes.forEach((hole) => addLoop(hole, rays));
  }
  for (const loop of row?.shell?.boundaries || []) {
    const clean = (loop || []).filter(isFinitePoint);
    if (clean.length >= 2) addLoop(clean, []);
  }

  if (!edges.length) return null;
  return { row, edges, faces, box: expandBox(boxOfPoints(points), tolerance) };
}

// Prolongations of the cut lines on a plane: for every maximal run of line
// points lying on the plane, a ray from each end where the line goes on OFF
// the plane, along the run's end direction (anchored like
// clipFaceByCutLines.extendContinuingEnds: beyond the gap-bridging stub).
function getPlaneSeparatorRays(basis, lines) {
  const rays = [];
  for (const { points } of lines) {
    const onPlane = points.map(
      (p) => Math.abs(dot(sub(p, basis.origin), basis.n)) <= PLANE_TOL_M
    );
    let start = -1;
    const flush = (end) => {
      if (start >= 0 && end - start >= 1) {
        if (start > 0) pushRay(rays, points, start, end, 1);
        if (end < points.length - 1) pushRay(rays, points, end, start, -1);
      }
      start = -1;
    };
    for (let i = 0; i < points.length; i++) {
      if (onPlane[i]) {
        if (start < 0) start = i;
      } else {
        flush(i - 1);
      }
    }
    flush(points.length - 1);
  }
  return rays;
}

// Ray leaving the run at points[endIdx], pointing away from the run (the
// anchor is searched from the end towards `limitIdx`, step by step).
function pushRay(rays, points, endIdx, limitIdx, step) {
  const end = points[endIdx];
  let anchor = points[endIdx + step];
  for (
    let k = endIdx + step;
    step > 0 ? k <= limitIdx : k >= limitIdx;
    k += step
  ) {
    if (distance(points[k], end) > CUT_LINE_GAP_TOLERANCE_M) {
      anchor = points[k];
      break;
    }
  }
  const direction = normalize(sub(end, anchor));
  if (!direction.x && !direction.y && !direction.z) return;
  rays.push({ origin: end, direction });
}

// --- contact ---

// A border edge of `a` carries a long enough free run on `b`.
function hasFreeContact(a, b, ctx) {
  const { tolerance, minSharedLength } = ctx;
  for (const edge of a.edges) {
    const len = distance(edge.a, edge.b);
    if (len < minSharedLength) continue;
    if (!boxesOverlap(expandBox(boxOfPoints([edge.a, edge.b]), 0), b.box)) {
      continue;
    }
    const count = Math.min(
      MAX_SAMPLES_PER_EDGE,
      Math.max(1, Math.ceil(len / SAMPLE_STEP_M))
    );
    const step = len / count;
    const needed = Math.ceil(minSharedLength / step - 1e-9);
    let run = 0;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = {
        x: edge.a.x + (edge.b.x - edge.a.x) * t,
        y: edge.a.y + (edge.b.y - edge.a.y) * t,
        z: edge.a.z + (edge.b.z - edge.a.z) * t,
      };
      const free =
        isPointOnMaille(p, b, tolerance) && !isSeparated(p, edge.rays, ctx);
      if (!free) {
        run = 0;
        continue;
      }
      run += 1;
      // `run` samples span (run - 1) steps.
      if (run - 1 >= needed) return true;
    }
  }
  return false;
}

function isPointOnMaille(p, maille, tolerance) {
  if (!boxContains(maille.box, p)) return false;
  const tolSq = tolerance * tolerance;
  for (const edge of maille.edges) {
    if (distSqPointToSegment(p, edge.a, edge.b) <= tolSq) return true;
  }
  for (const face of maille.faces) {
    const d = dot(sub(p, face.basis.origin), face.basis.n);
    if (Math.abs(d) > tolerance) continue;
    const p2d = projectPointTo2d(p, face.basis);
    if (!pointInPolygon2d(p2d, face.contour2d)) continue;
    if (face.holes2d.some((hole) => pointInPolygon2d(p2d, hole))) continue;
    return true;
  }
  return false;
}

// The point lies on a cut line, or on a prolongation ray of its face plane.
function isSeparated(p, rays, { lines, tolerance }) {
  const tolSq = tolerance * tolerance;
  for (const line of lines) {
    if (!boxContains(line.box, p)) continue;
    const pts = line.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      if (distSqPointToSegment(p, pts[i], pts[i + 1]) <= tolSq) return true;
    }
  }
  for (const ray of rays) {
    const d = sub(p, ray.origin);
    const t = Math.max(0, dot(d, ray.direction));
    const dx = d.x - t * ray.direction.x;
    const dy = d.y - t * ray.direction.y;
    const dz = d.z - t * ray.direction.z;
    if (dx * dx + dy * dy + dz * dz <= tolSq) return true;
  }
  return false;
}

// --- small geometry helpers ---

const isFinitePoint = (p) =>
  Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z);

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function distSqPointToSegment(p, a, b) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const ez = b.z - a.z;
  const lenSq = ex * ex + ey * ey + ez * ez;
  let t = 0;
  if (lenSq > 0) {
    t = ((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const dx = p.x - (a.x + t * ex);
  const dy = p.y - (a.y + t * ey);
  const dz = p.z - (a.z + t * ez);
  return dx * dx + dy * dy + dz * dz;
}

function boxOfPoints(points) {
  const box = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
  for (const p of points) {
    if (p.x < box.minX) box.minX = p.x;
    if (p.y < box.minY) box.minY = p.y;
    if (p.z < box.minZ) box.minZ = p.z;
    if (p.x > box.maxX) box.maxX = p.x;
    if (p.y > box.maxY) box.maxY = p.y;
    if (p.z > box.maxZ) box.maxZ = p.z;
  }
  return box;
}

const expandBox = (box, margin) => ({
  minX: box.minX - margin,
  minY: box.minY - margin,
  minZ: box.minZ - margin,
  maxX: box.maxX + margin,
  maxY: box.maxY + margin,
  maxZ: box.maxZ + margin,
});

const boxesOverlap = (b1, b2) =>
  b1.minX <= b2.maxX &&
  b2.minX <= b1.maxX &&
  b1.minY <= b2.maxY &&
  b2.minY <= b1.maxY &&
  b1.minZ <= b2.maxZ &&
  b2.minZ <= b1.maxZ;

const boxContains = (box, p) =>
  p.x >= box.minX &&
  p.x <= box.maxX &&
  p.y >= box.minY &&
  p.y <= box.maxY &&
  p.z >= box.minZ &&
  p.z <= box.maxZ;
