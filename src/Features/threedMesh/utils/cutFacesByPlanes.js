import polygonClipping from "polygon-clipping";

import computePlaneBasis from "./computePlaneBasis.js";
import { polygonArea2d, polygonCentroid2d } from "./computeFaceArea.js";
import {
  liftLoopTo3d,
  liftPointTo3d,
  projectLoopTo2d,
} from "./planeProjection.js";
import { dot } from "./vec3Utils.js";

// Splits the polygon faces of a maille by 1 or 2 world half-spaces (the
// angular-cut wedge, see getAngularWedge): `inside` collects the parts on the
// positive side of EVERY plane, `outside` the rest. Works face by face, so a
// multi-face maille (a profile swept along a polyline) is cut as a whole, and
// a vertical face is handled like any other — the planes are world objects,
// nothing is drawn in the face plane.
//
// Pure (no three.js), world coordinates in, world coordinates out.

// A boundary edge closer than this to a cut plane counts as lying on it (the
// red preview line). Matches the 0.1 mm weld used by the shell cuts.
const ON_PLANE_TOL = 1e-4;

const dot2 = (a, b) => a.x * b.x + a.y * b.y;

const closeRing = (loop) => {
  const ring = loop.map((p) => [p.x, p.y]);
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
};

const openLoop = (ring) =>
  ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));

function toPieces(multiPolygon) {
  const pieces = [];
  for (const polygon of multiPolygon || []) {
    if (!polygon.length) continue;
    const contour = openLoop(polygon[0]);
    if (contour.length < 3) continue;
    const holes = polygon
      .slice(1)
      .map(openLoop)
      .filter((hole) => hole.length >= 3);
    const area = polygonArea2d(contour, holes);
    if (area <= 0) continue;
    pieces.push({ contour, holes, area });
  }
  return pieces;
}

// World half-space {p : dot(n, p) >= c} seen from inside a face plane:
// a 2D half-plane {q : dot(n2, q) >= c2}, or a constant side when the face
// plane is parallel to the cut plane (n2 vanishes).
function toHalfPlane2d(plane, basis) {
  const n2 = { x: dot(plane.normal, basis.u), y: dot(plane.normal, basis.v) };
  const c2 = plane.constant - dot(plane.normal, basis.origin);
  const len = Math.hypot(n2.x, n2.y);
  if (len < 1e-12) return { parallel: true, inside: -c2 >= -ON_PLANE_TOL };
  return {
    parallel: false,
    n: { x: n2.x / len, y: n2.y / len },
    c: c2 / len,
  };
}

// Huge quad covering `extent` around `center` on the positive side of the
// 2D half-plane — the clipping stand-in for an infinite half-plane.
function halfPlaneBand(half, center, extent) {
  const { n, c } = half;
  // Foot of the line closest to the face, then run along it both ways.
  const d = dot2(n, center) - c;
  const foot = { x: center.x - n.x * d, y: center.y - n.y * d };
  const along = { x: -n.y, y: n.x };
  const p1 = {
    x: foot.x + along.x * extent,
    y: foot.y + along.y * extent,
  };
  const p2 = {
    x: foot.x - along.x * extent,
    y: foot.y - along.y * extent,
  };
  return [
    [
      [p1.x, p1.y],
      [p2.x, p2.y],
      [p2.x + n.x * extent, p2.y + n.y * extent],
      [p1.x + n.x * extent, p1.y + n.y * extent],
      [p1.x, p1.y],
    ],
  ];
}

/**
 * @param {object} args
 * @param {Array<{contour, holes, normal}>} args.faces - maille faces (world)
 * @param {Array<{normal, constant}>} args.planes - 1 or 2 half-spaces
 * @returns {{ inside, outside, segments }} each side is
 *   { faces, surface, centroid } (faces in world coords, centroid of its
 *   largest piece) or null when empty; `segments` are the world-space edges
 *   of the inside part lying on a cut plane (the red preview line).
 */
export default function cutFacesByPlanes({ faces, planes }) {
  if (!faces?.length || !planes?.length) return null;

  const insideFaces = [];
  const outsideFaces = [];
  const segments = [];
  let insideSurface = 0;
  let outsideSurface = 0;
  let insideBest = null;
  let outsideBest = null;

  for (const face of faces) {
    if (!face?.contour || face.contour.length < 3) continue;
    const basis = computePlaneBasis(face.normal, face.contour[0]);
    const contour2d = projectLoopTo2d(face.contour, basis);
    const holes2d = (face.holes || [])
      .filter((hole) => hole?.length >= 3)
      .map((hole) => projectLoopTo2d(hole, basis));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of contour2d) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const extent = 4 * (Math.hypot(maxX - minX, maxY - minY) || 1);

    const subject = [[closeRing(contour2d), ...holes2d.map(closeRing)]];
    const halves = planes.map((plane) => toHalfPlane2d(plane, basis));

    // A face parallel to a cut plane is entirely in or entirely out of that
    // half-space: no clipping to do, only a verdict to honour.
    let insideGeom = subject;
    let dropped = false;
    const lines = [];
    for (const half of halves) {
      if (half.parallel) {
        if (!half.inside) dropped = true;
        continue;
      }
      lines.push(half);
      try {
        insideGeom = polygonClipping.intersection(
          insideGeom,
          halfPlaneBand(half, center, extent)
        );
      } catch (error) {
        console.error("[cutFacesByPlanes] polygon-clipping error:", error);
        return null;
      }
      if (!insideGeom?.length) break;
    }

    let inPieces = dropped ? [] : toPieces(insideGeom);
    let outPieces;
    if (dropped) {
      outPieces = toPieces(subject);
    } else if (!inPieces.length) {
      outPieces = toPieces(subject);
    } else {
      try {
        outPieces = toPieces(polygonClipping.difference(subject, insideGeom));
      } catch (error) {
        console.error("[cutFacesByPlanes] polygon-clipping error:", error);
        return null;
      }
    }

    const collect = (pieces, target, best, addSegments) => {
      let bestPiece = best;
      let surface = 0;
      for (const piece of pieces) {
        target.push({
          contour: liftLoopTo3d(piece.contour, basis),
          holes: piece.holes.map((hole) => liftLoopTo3d(hole, basis)),
          normal: face.normal,
        });
        surface += piece.area;
        if (!bestPiece || piece.area > bestPiece.area) {
          bestPiece = {
            area: piece.area,
            centroid: liftPointTo3d(polygonCentroid2d(piece.contour), basis),
          };
        }
        if (!addSegments) continue;
        // Preview line: the edges of the kept part that run along a cut plane.
        for (const loop of [piece.contour, ...piece.holes]) {
          for (let i = 0; i < loop.length; i++) {
            const p = loop[i];
            const q = loop[(i + 1) % loop.length];
            const onLine = lines.some(
              (line) =>
                Math.abs(dot2(line.n, p) - line.c) <= ON_PLANE_TOL &&
                Math.abs(dot2(line.n, q) - line.c) <= ON_PLANE_TOL
            );
            if (onLine) {
              segments.push([liftPointTo3d(p, basis), liftPointTo3d(q, basis)]);
            }
          }
        }
      }
      return { best: bestPiece, surface };
    };

    const inResult = collect(inPieces, insideFaces, insideBest, true);
    insideBest = inResult.best;
    insideSurface += inResult.surface;
    const outResult = collect(outPieces, outsideFaces, outsideBest, false);
    outsideBest = outResult.best;
    outsideSurface += outResult.surface;
  }

  return {
    inside: insideFaces.length
      ? {
          faces: insideFaces,
          surface: insideSurface,
          centroid: insideBest?.centroid || null,
        }
      : null,
    outside: outsideFaces.length
      ? {
          faces: outsideFaces,
          surface: outsideSurface,
          centroid: outsideBest?.centroid || null,
        }
      : null,
    segments,
  };
}
