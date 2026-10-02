import { Vector3 } from "three";

import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";

// Two normals are parallel above this |dot| (≈ 5°) — same rule as the
// coplanar triangles of useVertexSnap.
const PARALLEL_NORMAL_DOT = 0.9962;
// The edge lies parallel to a plane under this |edgeDir · normal| (≈ 5°).
const EDGE_IN_PLANE_SIN = 0.0872;
// Under this distance (m) to the edge line, the last vertex does not define
// a plane with the edge (drawing along the edge itself).
const COLLINEAR_EPS_M = 1e-2;
// Half-length (m) of the cross arms on a derived plane — the face hit's
// (intersectAnnotationFace).
const CROSS_HALF_LENGTH_M = 0.5;

function translateAxis(axis, delta) {
  return [axis[0].clone().add(delta), axis[1].clone().add(delta)];
}

// Unit normal of a plane hit: its own (face, scan) or the cross axes' (base
// map plane) — a fresh vector, never the hit's own (callers may negate it).
export function getPlaneHitNormal(planeHit) {
  if (planeHit.normal) {
    const { x, y, z } = planeHit.normal;
    const normal = new Vector3(x, y, z);
    return normal.lengthSq() > 1e-12 ? normal.normalize() : null;
  }
  if (!planeHit.axisA || !planeHit.axisB) return null;
  const dirA = planeHit.axisA[1].clone().sub(planeHit.axisA[0]);
  const dirB = planeHit.axisB[1].clone().sub(planeHit.axisB[0]);
  const normal = dirA.cross(dirB);
  return normal.lengthSq() > 1e-12 ? normal.normalize() : null;
}

// Cross helper ("cursor") of a point snapped on an edge: the in-plane axes
// of the DRAWING plane, through `position`. Stable while the cursor wobbles
// from one side of the edge to the other (the surface under it flips from
// one face to its neighbour):
//   - the hovered plane (base map / face, not a scan) when the edge runs
//     parallel to it and, with a last vertex, the plane (edge, last vertex)
//     is parallel to it too — keeps the image axes of a rotated base map;
//   - else the plane (edge, last vertex), with a face's basis
//     (computePlaneBasis: horizontal + up the slope);
//   - else null (no last vertex, or the last vertex on the edge line, and
//     no usable hovered plane): a bare edge snap.
//
// Returns { axisA, axisB } (pairs of world points) or null.
export default function getEdgeSnapFrame({
  planeHit,
  edge,
  position,
  lastVertex,
}) {
  if (!edge || !position) return null;
  const [start, end] = edge;
  const edgeDir = end.clone().sub(start);
  if (edgeDir.lengthSq() < 1e-12) return null;
  edgeDir.normalize();

  let derivedNormal = null;
  if (lastVertex) {
    const toLast = new Vector3(lastVertex.x, lastVertex.y, lastVertex.z).sub(
      start
    );
    const normal = edgeDir.clone().cross(toLast);
    if (normal.length() > COLLINEAR_EPS_M) derivedNormal = normal.normalize();
  }

  const isPlanarHit =
    planeHit?.position && !planeHit.isScan && planeHit.axisA && planeHit.axisB;
  const hitNormal = isPlanarHit ? getPlaneHitNormal(planeHit) : null;
  if (
    hitNormal &&
    Math.abs(edgeDir.dot(hitNormal)) < EDGE_IN_PLANE_SIN &&
    (!derivedNormal ||
      Math.abs(derivedNormal.dot(hitNormal)) > PARALLEL_NORMAL_DOT)
  ) {
    const delta = position.clone().sub(planeHit.position);
    return {
      axisA: translateAxis(planeHit.axisA, delta),
      axisB: translateAxis(planeHit.axisB, delta),
    };
  }

  if (!derivedNormal) return null;
  const basis = computePlaneBasis(derivedNormal, position);
  const arm = ({ x, y, z }) => {
    const dir = new Vector3(x, y, z);
    return [
      position.clone().addScaledVector(dir, -CROSS_HALF_LENGTH_M),
      position.clone().addScaledVector(dir, CROSS_HALF_LENGTH_M),
    ];
  };
  return { axisA: arm(basis.u), axisB: arm(basis.v) };
}
