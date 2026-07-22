import polygonClipping from "polygon-clipping";

import computePlaneBasis from "./computePlaneBasis.js";
import { signedArea2d } from "./computeFaceArea.js";
import { liftLoopTo3d, projectLoopTo2d } from "./planeProjection.js";
import { dot } from "./vec3Utils.js";

// Merges coplanar maille faces that touch or overlap into single faces via a
// 2D boolean union in the shared plane basis. Faces on different planes (or
// coplanar but opposite-facing — signed normal comparison) are left untouched;
// disjoint coplanar faces stay separate too, since the union returns them as
// separate polygons of the MultiPolygon.
//
// Pure (no three.js): operates on world-coord faces {contour, holes, normal},
// so it is directly replayable from node scripts.

// Same angular tolerance as the hover region grow (faceHoverHighlight
// TOLERANCE_RAD): faces join a plane group while
// dot(faceNormal, groupNormal) >= cos(COALESCE_NORMAL_TOL_RAD).
export const COALESCE_NORMAL_TOL_RAD = 1e-2;

// Same-plane offset slack (meters). Faces born from the same source plane are
// exactly coplanar in the DB (the 1 mm display lift is display-only), so
// 1 mm only absorbs float noise without ever bridging distinct planes.
export const COALESCE_PLANE_TOL_M = 1e-3;

// 2D grid snap (meters) applied before the union so near-identical boundary
// vertices of touching faces land on the same coordinates. The grid is
// scale-aware: CSG-carved geometries store float32 positions, so two copies of
// the same seam vertex differ by ~|coord| * 2^-23 — a fixed 1e-6 grid stops
// welding a few meters away from the local origin. Capped at WELD_PRECISION
// (1e-4, the codebase-wide "same point" scale).
const SNAP_MIN_M = 1e-6;
const SNAP_FLOAT32_REL = 4e-6;
const SNAP_MAX_M = 1e-4;

// Collinear-vertex cleanup on union output (T-junction seams leave mid-edge
// vertices behind). Same sin threshold as extractRegionBoundaryLoops.
const COLLINEAR_SIN = 1e-4;

// T-junction repair skips groups bigger than this (O(points × segments)).
const REPAIR_MAX_POINTS = 4000;

const closeRing = (ring) => {
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
};

// Dissolving a T-junction seam requires BOTH sides to carry the same
// vertices: a fragment whose long edge passes through another fragment's
// mid-edge vertex (within eps) gets that vertex spliced into the edge, so
// after snapping the two seam copies coincide exactly and the union removes
// them. Mutates the rings in place; inserted points are cleaned up by the
// collinear filter on the union output.
function repairTJunctions(rings, eps) {
  const points = [];
  const seen = new Set();
  for (const ring of rings) {
    for (const p of ring) {
      const key = `${p[0]}_${p[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push(p);
      }
    }
  }
  if (points.length > REPAIR_MAX_POINTS) return;

  const epsSq = eps * eps;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      const ex = bx - ax;
      const ey = by - ay;
      const lenSq = ex * ex + ey * ey;
      if (lenSq <= epsSq) continue;

      const inserts = [];
      for (const p of points) {
        const [px, py] = p;
        if ((px === ax && py === ay) || (px === bx && py === by)) continue;
        const t = ((px - ax) * ex + (py - ay) * ey) / lenSq;
        if (t <= 0 || t >= 1) continue;
        const dx = px - (ax + t * ex);
        const dy = py - (ay + t * ey);
        if (dx * dx + dy * dy > epsSq) continue;
        inserts.push({ t, p });
      }
      if (inserts.length) {
        inserts.sort((i1, i2) => i1.t - i2.t);
        ring.splice(i + 1, 0, ...inserts.map((ins) => ins.p));
        i += inserts.length;
      }
    }
  }
}

const openLoop = (ring) =>
  ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));

function removeCollinearVertices2d(loop) {
  if (loop.length < 3) return loop;
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length];
    const p = loop[i];
    const next = loop[(i + 1) % loop.length];
    const e1x = p.x - prev.x;
    const e1y = p.y - prev.y;
    const e2x = next.x - p.x;
    const e2y = next.y - p.y;
    const l1 = Math.hypot(e1x, e1y);
    const l2 = Math.hypot(e2x, e2y);
    if (l1 === 0 || l2 === 0) continue; // duplicate point
    const sin = Math.abs(e1x * e2y - e1y * e2x) / (l1 * l2);
    if (sin > COLLINEAR_SIN) out.push(p);
  }
  return out;
}

// Normalize an open loop to the requested winding (contour CCW / holes CW in
// the plane basis, matching extractRegionBoundaryLoops).
function withWinding(loop, ccw) {
  const area = signedArea2d(loop);
  if (area === 0) return null;
  return area > 0 === ccw ? loop : [...loop].reverse();
}

function unionGroup(group) {
  const basis = computePlaneBasis(group.n, group.faces[0].contour[0]);

  // Scale-aware snap grid: sized on the largest 3D coordinate magnitude so
  // float32 noise (~|coord| * 2^-23) always lands inside one cell.
  let maxAbs = 0;
  for (const face of group.faces) {
    for (const loop of [face.contour, ...(face.holes || [])]) {
      for (const p of loop || []) {
        const m = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
        if (m > maxAbs) maxAbs = m;
      }
    }
  }
  const grid = Math.min(
    SNAP_MAX_M,
    Math.max(SNAP_MIN_M, maxAbs * SNAP_FLOAT32_REL)
  );
  const snap = (v) => Math.round(v / grid) * grid;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const allRings = [];
  const polygons = group.faces.map((face) => {
    const rings = [face.contour, ...(face.holes || [])]
      .filter((loop) => loop?.length >= 3)
      .map((loop) =>
        projectLoopTo2d(loop, basis).map((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
          return [snap(p.x), snap(p.y)];
        })
      );
    allRings.push(...rings);
    return rings;
  });

  repairTJunctions(allRings, grid * 1.5);

  let unioned;
  try {
    unioned = polygonClipping.union(
      ...polygons.map((rings) => [rings.map((ring) => closeRing([...ring]))])
    );
  } catch (error) {
    console.error("[coalesceCoplanarFaces] polygon-clipping error:", error);
    return group.faces;
  }

  // Ignore slivers born from numerical noise along dissolved seams.
  const diag = Math.hypot(maxX - minX, maxY - minY);
  const minArea = diag * diag * 1e-9;

  const faces = [];
  for (const polygon of unioned) {
    if (!polygon.length) continue;
    const contour = withWinding(
      removeCollinearVertices2d(openLoop(polygon[0])),
      true
    );
    if (!contour || contour.length < 3) continue;
    if (Math.abs(signedArea2d(contour)) < minArea) continue;
    const holes = polygon
      .slice(1)
      .map((ring) =>
        withWinding(removeCollinearVertices2d(openLoop(ring)), false)
      )
      .filter((hole) => hole && hole.length >= 3);
    faces.push({
      contour: liftLoopTo3d(contour, basis),
      holes: holes.map((hole) => liftLoopTo3d(hole, basis)),
      normal: { ...basis.n },
    });
  }
  // A union that degenerates entirely would silently drop the group — keep
  // the original faces instead.
  return faces.length ? faces : group.faces;
}

/**
 * @param {Array<{contour, holes, normal}>} faces - world-coord maille faces
 * @returns {Array<{contour, holes, normal}>} faces, with coplanar same-facing
 *   groups replaced by their 2D union (untouched face objects otherwise)
 */
export default function coalesceCoplanarFaces(faces) {
  const cosTol = Math.cos(COALESCE_NORMAL_TOL_RAD);

  // Greedy first-match plane grouping. Invalid faces form their own singleton
  // group so they pass through unchanged, in order.
  const groups = [];
  for (const face of faces || []) {
    if (!face) continue;
    const valid = face.contour?.length >= 3 && face.normal;
    const group = valid
      ? groups.find(
          (g) =>
            g.n &&
            dot(face.normal, g.n) >= cosTol &&
            Math.abs(dot(g.n, face.contour[0]) - g.d) <= COALESCE_PLANE_TOL_M
        )
      : null;
    if (group) {
      group.faces.push(face);
    } else {
      groups.push({
        n: valid ? face.normal : null,
        d: valid ? dot(face.normal, face.contour[0]) : 0,
        faces: [face],
      });
    }
  }

  return groups.flatMap((group) =>
    group.faces.length < 2 ? group.faces : unionGroup(group)
  );
}
