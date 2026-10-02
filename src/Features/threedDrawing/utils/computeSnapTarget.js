import { Vector3 } from "three";

import alignPlaneHitToVertices from "./alignPlaneHitToVertices";
import getEdgeSnapFrame, { getPlaneHitNormal } from "./getEdgeSnapFrame";
import inPlaneOrthoSnap from "./inPlaneOrthoSnap";
import lockEdgeSnapToAxes from "./lockEdgeSnapToAxes";

// Pixel threshold under which the cursor is considered "on" an axis line
// projected through the last committed vertex.
const AXIS_THRESHOLD_PX = 20;

// A vertex / edge further than this (m) behind the plane under the cursor is
// hidden by it — absorbs the 1 mm z-fight lift of the annotation faces
// (matches inPlaneOrthoSnap's COPLANAR_EPS_M).
const OCCLUSION_EPS_M = 5e-3;

const AXES = [
  { key: "X", vec: new Vector3(1, 0, 0) },
  { key: "Y", vec: new Vector3(0, 1, 0) },
  { key: "Z", vec: new Vector3(0, 0, 1) },
];

function ndcDistance(world, mouseNdc, camera, canvasSize) {
  const v = world.clone().project(camera);
  const dx = ((v.x - mouseNdc.x) * canvasSize.width) / 2;
  const dy = ((v.y - mouseNdc.y) * canvasSize.height) / 2;
  return {
    distance: Math.sqrt(dx * dx + dy * dy),
    behind: v.z < -1 || v.z > 1,
  };
}

// Closest approach point on the axis line `last + t * axisVec` to the camera
// ray `camPos + s * cursorDir`. Returns null when the lines are parallel.
function closestPointOnAxis(camPos, cursorDir, last, axisVec) {
  const b = cursorDir.dot(axisVec);
  const denom = 1 - b * b;
  if (denom < 1e-6) return null;
  const d = camPos.clone().sub(last);
  const t = (d.dot(axisVec) - b * d.dot(cursorDir)) / denom;
  return last.clone().add(axisVec.clone().multiplyScalar(t));
}

function getCursorDir(mouseNdc, camera) {
  const v = new Vector3(mouseNdc.x, mouseNdc.y, 0.5).unproject(camera);
  return v.sub(camera.position).normalize();
}

function intersectRayWithPlane(camPos, cursorDir, planePoint, planeNormal) {
  const denom = cursorDir.dot(planeNormal);
  if (Math.abs(denom) < 1e-6) return null;
  const t = planeNormal.dot(planePoint.clone().sub(camPos)) / denom;
  if (t < 0) return null;
  return camPos.clone().add(cursorDir.clone().multiplyScalar(t));
}

// Snap candidate from a flat list of {x, y, z} points (the in-progress
// polyline). Returned with `meshKey: undefined` because these points don't
// belong to a Three.js mesh.
function snapToInProgress(
  mouseNdc,
  camera,
  canvasSize,
  polyline,
  pixelThreshold = 12
) {
  if (!polyline?.length || !camera || !canvasSize) return null;
  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const mouseX = mouseNdc.x * halfW;
  const mouseY = mouseNdc.y * halfH;
  let best = null;
  let bestSq = pixelThreshold * pixelThreshold;
  for (const p of polyline) {
    const v = new Vector3(p.x, p.y, p.z).project(camera);
    if (v.z < -1 || v.z > 1) continue;
    const sx = v.x * halfW;
    const sy = v.y * halfH;
    const dx = sx - mouseX;
    const dy = sy - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestSq) {
      bestSq = d2;
      best = p;
    }
  }
  if (!best) return null;
  return { position: new Vector3(best.x, best.y, best.z), meshKey: undefined };
}

// Compute the click target for the current cursor position. Tries in order:
//   1. snap to a vertex of the in-progress polyline (lets the user close
//      back to the first vertex without redrawing)
//   2. snap to nearest existing mesh vertex (within pixel threshold)
//   3. snap to the nearest mesh edge (optional `findNearestEdge` callback),
//      with the cross helper of the drawing plane (getEdgeSnapFrame) and the
//      axis snap ALONG the edge (lockEdgeSnapToAxes: ortho from the last
//      vertex, alignment with another vertex) — kind stays "EDGE"
//   3b. a point on a scan base map under the cursor (`planeHit.isScan`,
//      kind "SCAN") — taken as is, no lock
//   4. with no last vertex: a base map plane hit (optional `intersectPlane`
//      callback), refined by vertex alignment — this is how the FIRST point
//      of a drawing lands on a bare plan
//   5. in-plane ortho lock along the hovered plane's axes through the last
//      vertex (beats the world axes on rotated / vertical base maps),
//      refined by vertex alignment ALONG the locked line (both arms lock)
//   6. snap to the world axis line (X / Y / Z) closest to the cursor
//      ray, anchored at the last committed vertex
//   7. the base map plane hit (refined by vertex alignment)
//   8. fall back to a free position on the plane through the last vertex
//      perpendicular to the camera
//
// Vertex alignment (alignPlaneHitToVertices, the 2D axis snap in the hovered
// plane) reads the scene vertices (`alignAdjacency`) and the points of the
// drawing in progress (`inProgressPolyline`).
//
// Vertices / edges hidden behind the surface under the cursor (the plan or
// face being drawn on, a scan) are not snap targets (`findNearestVertex` /
// `findNearestEdge` receive an `{ accept }` filter): the bottom edges of a
// solid must not steal the point placed on its top face.
//
// The plane hit may also be a FACE of an annotation (mesh drawing mode, see
// intersectAnnotationFace — `planeHit.isFace`): same cascade, the snap then
// reads "FACE", carries the hit annotation (`nodeId`, `faceNormal`) and the
// world-axis lock is skipped (it would pull the point off the face; the
// in-plane ortho lock already covers the face's own axes).
//
// Returns { position, kind, meshKey?, nodeId?, axis?, lockedAxes?, baseMapId?,
// axisA?, axisB?, alignFrom?, faceNormal? } or null when no candidate is
// available.
export default function computeSnapTarget({
  mouseNdc,
  camera,
  canvasSize,
  lastVertex,
  inProgressPolyline,
  findNearestVertex,
  findNearestEdge = null,
  intersectPlane = null,
  alignAdjacency = null,
  attachFaceToPointSnaps = false,
}) {
  // Plane / face / scan under the cursor — resolved once, on first need.
  let cachedPlaneHit;
  const getPlaneHit = () => {
    if (cachedPlaneHit === undefined) {
      cachedPlaneHit = intersectPlane?.(mouseNdc) ?? null;
    }
    return cachedPlaneHit;
  };

  // Mesh drawing mode: a vertex / edge snap also reports the face under the
  // cursor (its normal), so a rectangle anchored on a corner knows its plane.
  const withFaceUnderCursor = (snap) => {
    if (!attachFaceToPointSnaps) return snap;
    const hit = getPlaneHit();
    if (!hit?.isFace) return snap;
    return {
      ...snap,
      nodeId: snap.nodeId ?? hit.nodeId,
      faceNormal: hit.normal,
      baseMapId: hit.baseMapId,
    };
  };

  const inProgressSnap = snapToInProgress(
    mouseNdc,
    camera,
    canvasSize,
    inProgressPolyline
  );
  if (inProgressSnap?.position) {
    return {
      position: inProgressSnap.position,
      meshKey: undefined,
      kind: "VERTEX",
    };
  }

  // A vertex / edge lying BEHIND the surface under the cursor is hidden by
  // it: it must not steal the point the user is placing on that surface.
  //   - scan: the snap sits up to a few px away from the cursor ray, on a
  //     surface seen at an angle — camera distance with a tolerance;
  //   - plane (base map, annotation face, rectangle anchor plane): the side
  //     of the plane seen from the camera.
  let cachedOccluder;
  const getOccluderPlane = () => {
    if (cachedOccluder !== undefined) return cachedOccluder;
    cachedOccluder = null;
    const hit = getPlaneHit();
    if (!hit?.position || hit.isScan) return cachedOccluder;
    const normal = getPlaneHitNormal(hit);
    if (!normal) return cachedOccluder;
    // Oriented towards the camera.
    if (normal.dot(camera.position.clone().sub(hit.position)) < 0) {
      normal.negate();
    }
    cachedOccluder = { point: hit.position, normal };
    return cachedOccluder;
  };
  const toCandidate = new Vector3();
  const isHiddenBySurface = (position) => {
    const hit = getPlaneHit();
    if (!hit) return false;
    if (hit.isScan) {
      return camera.position.distanceTo(position) > hit.distance * 1.02 + 0.1;
    }
    const plane = getOccluderPlane();
    if (!plane) return false;
    toCandidate.copy(position).sub(plane.point);
    return toCandidate.dot(plane.normal) < -OCCLUSION_EPS_M;
  };
  const snapFilter = { accept: (position) => !isHiddenBySurface(position) };

  const vertexSnap = findNearestVertex(
    mouseNdc,
    camera,
    canvasSize,
    snapFilter
  );
  if (vertexSnap?.position) {
    return withFaceUnderCursor({
      position: vertexSnap.position,
      meshKey: vertexSnap.meshKey,
      nodeId: vertexSnap.nodeId,
      kind: "VERTEX",
    });
  }

  const edgeSnap = findNearestEdge?.(mouseNdc, camera, canvasSize, snapFilter);
  if (edgeSnap?.position) {
    const snap = {
      position: edgeSnap.position,
      kind: "EDGE",
      nodeId: edgeSnap.nodeId,
    };
    // The cross helper stays visible on the edge (the cursor), and the
    // point stops where an arm runs through the last vertex (ortho) or
    // another vertex (alignment) — where to stop while sliding along it.
    const frame = getEdgeSnapFrame({
      planeHit: getPlaneHit(),
      edge: edgeSnap.edge,
      position: edgeSnap.position,
      lastVertex,
    });
    const locked = frame
      ? lockEdgeSnapToAxes({
          edge: edgeSnap.edge,
          position: edgeSnap.position,
          axisA: frame.axisA,
          axisB: frame.axisB,
          lastVertex,
          adjacency: alignAdjacency,
          extraPoints: inProgressPolyline,
          camera,
          canvasSize,
        })
      : null;
    return withFaceUnderCursor({ ...snap, ...frame, ...locked });
  }

  const planeHit = getPlaneHit();

  // scan base map under the cursor (intersectScene3d):
  //   - still being prepared for picking → no target at all, rather than a
  //     point that would silently land on the plan BEHIND the scan;
  //   - a point ON the scan surface is final — every lock below (in-plane
  //     ortho, vertex alignment, world axes) would pull it off a surface
  //     that is not a plane.
  if (planeHit?.isPending) return null;
  if (planeHit?.isScan) {
    return {
      position: planeHit.position,
      kind: "SCAN",
      baseMapId: planeHit.baseMapId,
      axisA: planeHit.axisA,
      axisB: planeHit.axisB,
    };
  }
  // Snaps derived from a face hit keep pointing at the hit annotation.
  const withFace = (snap) =>
    snap && planeHit?.isFace
      ? { ...snap, nodeId: planeHit.nodeId, faceNormal: planeHit.normal }
      : snap;
  const refinePlaneHit = () => {
    const aligned = alignPlaneHitToVertices({
      planeHit,
      adjacency: alignAdjacency,
      extraPoints: inProgressPolyline,
      camera,
      canvasSize,
    });
    if (aligned) return withFace(aligned);
    return withFace({
      position: planeHit.position,
      kind: planeHit.isFace ? "FACE" : "PLANE",
      baseMapId: planeHit.baseMapId,
      axisA: planeHit.axisA,
      axisB: planeHit.axisB,
    });
  };

  if (!lastVertex) return planeHit ? refinePlaneHit() : null;

  if (planeHit) {
    const ortho = inPlaneOrthoSnap({
      planeHit,
      lastVertex,
      mouseNdc,
      camera,
      canvasSize,
    });
    if (ortho) {
      // The point stays on the locked line and slides along it onto the
      // coordinate of another vertex: ortho from the last point AND aligned
      // with e.g. the first one (closing a rectangle).
      const aligned = alignPlaneHitToVertices({
        planeHit: {
          ...planeHit,
          position: ortho.position,
          axisA: ortho.axisA,
          axisB: ortho.axisB,
        },
        adjacency: alignAdjacency,
        extraPoints: inProgressPolyline,
        slideAxes: [ortho.axis],
        camera,
        canvasSize,
      });
      if (!aligned) return withFace(ortho);
      return withFace({
        ...ortho,
        position: aligned.position,
        lockedAxes: { A: true, B: true },
        axisA: aligned.axisA,
        axisB: aligned.axisB,
        alignFrom: aligned.alignFrom,
      });
    }
  }

  const lastVec = new Vector3(lastVertex.x, lastVertex.y, lastVertex.z);
  const cursorDir = getCursorDir(mouseNdc, camera);

  let bestAxis = null;
  let bestDist = AXIS_THRESHOLD_PX;
  let bestPosition = null;
  for (const ax of planeHit?.isFace ? [] : AXES) {
    const pt = closestPointOnAxis(camera.position, cursorDir, lastVec, ax.vec);
    if (!pt) continue;
    const { distance, behind } = ndcDistance(pt, mouseNdc, camera, canvasSize);
    if (behind) continue;
    if (distance < bestDist) {
      bestDist = distance;
      bestAxis = ax.key;
      bestPosition = pt;
    }
  }
  if (bestAxis && bestPosition) {
    return {
      position: bestPosition,
      kind: `AXIS_${bestAxis}`,
      axis: bestAxis,
    };
  }

  // A hovered base map plane beats the camera-facing FREE plane — the latter
  // is almost never wanted while the cursor is over a plan.
  if (planeHit) return refinePlaneHit();

  const camForward = new Vector3();
  camera.getWorldDirection(camForward);
  const free = intersectRayWithPlane(
    camera.position,
    cursorDir,
    lastVec,
    camForward
  );
  if (!free) return null;
  return { position: free, kind: "FREE" };
}
