import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";
import {
  getFace2d,
  locateOnFaceBoundary,
} from "../../annotationMesh3d/utils/mesh3dFace2d.js";
import {
  getDistanceToFacePlane,
  getFaceNormal,
} from "../../annotationMesh3d/utils/mesh3dTopology.js";

// A cut path drawn on the DISPLAYED host, moved onto the face of its mesh it
// was meant for. The displayed host may differ slightly from the converted
// mesh: « Réduire le crénelage des parements » insets wall / band faces by
// 10 mm and lowers their tops by 5 mm, and the conversion now reads the
// un-shrunk object (getEditableMesh3d) — the exact on-face test of
// splitMesh3dFace (2 mm) then misses the path.
//
// The face: every point within `planeTolM` of its plane and inside its
// outline (with `snapTolM` of slack), one probe (point or segment midpoint)
// strictly inside; faces turned toward the camera first when `rayDir` (the
// view ray, local frame) is given — a shrunk top under 10 mm lies nearer
// the bottom plane —, then the nearest plane (max point distance). The path:
// projected on that plane, points within `snapTolM` of the outline moved
// onto it (the drawn path ran edge to edge on the shrunk face).
//
// mesh: LOCAL mesh {vertices: [{x, y, z}], faces: [{loop, holes}]}; points
// in the same frame. faceIndices: the only faces considered (null: any
// face). Returns {faceIndex, points} or null.
//
// Pure: node-testable.

export const SNAP_PLANE_TOL_M = 0.02;
export const SNAP_OUTLINE_TOL_M = 0.012;

function getProbes(points, closed) {
  const probes = [...points];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    probes.push({
      x: (p.x + q.x) / 2,
      y: (p.y + q.y) / 2,
      z: (p.z + q.z) / 2,
    });
  }
  return probes;
}

function isInsideFace2d(face2d, p) {
  const [contour, ...holes] = face2d.loops;
  return (
    pointInPolygon2d(p, contour) &&
    !holes.some((hole) => pointInPolygon2d(p, hole))
  );
}

function snapToOutline(face2d, face, p, tolerance) {
  const onBoundary = locateOnFaceBoundary(face2d, face, p, tolerance);
  if (!onBoundary) return p;
  const loop = face2d.loops[onBoundary.loopIndex];
  if (onBoundary.kind === "VERTEX") {
    const vertex = loop[onBoundary.index];
    return { x: vertex.x, y: vertex.y };
  }
  const a = loop[onBoundary.index];
  const b = loop[(onBoundary.index + 1) % loop.length];
  return {
    x: a.x + (b.x - a.x) * onBoundary.t,
    y: a.y + (b.y - a.y) * onBoundary.t,
  };
}

export default function snapPathOntoMesh3dFace(
  mesh,
  points,
  {
    closed = false,
    planeTolM = SNAP_PLANE_TOL_M,
    snapTolM = SNAP_OUTLINE_TOL_M,
    rayDir = null,
    faceIndices = null,
  } = {}
) {
  if (!mesh?.faces?.length || !mesh.vertices?.length || !points?.length) {
    return null;
  }
  const allowed = faceIndices ? new Set(faceIndices) : null;
  const probes = getProbes(points, closed);
  const facing = (normal) =>
    rayDir
      ? normal.x * rayDir.x + normal.y * rayDir.y + normal.z * rayDir.z < 0
      : true;

  let best = -1;
  let bestDist = Infinity;
  let bestFront = false;
  mesh.faces.forEach((face, faceIndex) => {
    if (!(face?.loop?.length >= 3)) return;
    if (allowed && !allowed.has(faceIndex)) return;
    const normal = getFaceNormal(mesh.vertices, face);
    const maxDist = Math.max(
      ...points.map((p) =>
        Math.abs(getDistanceToFacePlane(mesh.vertices, face, p, normal))
      )
    );
    const front = facing(normal);
    if (!(maxDist <= planeTolM)) return;
    if (best >= 0 && bestFront && !front) return;
    if (best >= 0 && front === bestFront && maxDist >= bestDist) return;
    const face2d = getFace2d(mesh.vertices, face);
    let hasInside = false;
    for (const probe of probes) {
      const p = projectPointTo2d(probe, face2d.basis);
      if (isInsideFace2d(face2d, p)) {
        if (!locateOnFaceBoundary(face2d, face, p, snapTolM)) hasInside = true;
        continue;
      }
      if (!locateOnFaceBoundary(face2d, face, p, snapTolM)) return;
    }
    if (!hasInside) return;
    best = faceIndex;
    bestDist = maxDist;
    bestFront = front;
  });
  if (best < 0) return null;

  const face = mesh.faces[best];
  const face2d = getFace2d(mesh.vertices, face);
  return {
    faceIndex: best,
    points: points.map((point) => {
      const p = snapToOutline(
        face2d,
        face,
        projectPointTo2d(point, face2d.basis),
        snapTolM
      );
      const lifted = liftPointTo3d(p, face2d.basis);
      return point.nodeId !== undefined
        ? { ...lifted, nodeId: point.nodeId }
        : lifted;
    }),
  };
}
