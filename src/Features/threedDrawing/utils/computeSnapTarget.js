import { Vector3 } from "three";

import alignPlaneHitToVertices from "./alignPlaneHitToVertices.js";
import getEdgeSnapFrame, { getPlaneHitNormal } from "./getEdgeSnapFrame.js";
import inPlaneOrthoSnap from "./inPlaneOrthoSnap.js";
import lockEdgeSnapToAxes from "./lockEdgeSnapToAxes.js";

// Pixel threshold under which the cursor is considered "on" an axis line
// projected through the last committed vertex.
const AXIS_THRESHOLD_PX = 20;

// A vertex / edge further than this (m) behind the plane under the cursor is
// hidden by it — absorbs the 1 mm z-fight lift of the annotation faces
// (matches inPlaneOrthoSnap's COPLANAR_EPS_M).
const OCCLUSION_EPS_M = 5e-3;

// A snap candidate further than this (m) from the LOCKED plane (either side)
// would pull the point off the face the drawing is bound to.
const LOCK_PLANE_EPS_M = 5e-3;

// Default axis lines (raw world axes) when the caller passes no `axes` —
// the drawing overlay passes the user axes of the gizmo frame
// (getUserAxesWorldDirections), whose keys colour and label the lock.
const WORLD_AXES = [
  { key: "X", dir: new Vector3(1, 0, 0) },
  { key: "Y", dir: new Vector3(0, 1, 0) },
  { key: "Z", dir: new Vector3(0, 0, 1) },
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
//   6. snap to the axis line (`axes`: the user axes X / Y / Z of the gizmo
//      frame, world axes by default) closest to the cursor ray, anchored at
//      the last committed vertex
//   7. the base map plane hit (refined by vertex alignment)
//   8. nothing under the cursor: the "natural" plane (optional
//      `intersectFallbackPlane` callback — the user-axis plane most facing
//      the camera through the first / last vertex, see pickNaturalPlane),
//      with the same in-plane ortho lock + vertex alignment as a hovered
//      plane; the hit is tagged `isNatural`
//   9. fall back to a free position on the plane through the last vertex
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
// A LOCKED plane (`lockedPlane: { point, normal }` — the "Coupe face" tools
// bound to the selected face): every candidate must lie on it. Vertex / edge
// snaps off the plane are rejected (an edge snap slid along a crossing edge
// falls through to the plane hit), the plane hit is the caller's (ray ∩
// locked plane), the world-axis, natural-plane and FREE fallbacks are
// skipped, and a snap that still left the plane is dropped: no target rather
// than a point off the face. The polygon being drawn locks its own plane the
// same way once it has 3 points (computeDraftPlane).
//
// Returns { position, kind, meshKey?, nodeId?, axis?, lockedAxes?, baseMapId?,
// axisA?, axisB?, axisKeys?, alignFrom?, faceNormal?, isNatural? } or null
// when no candidate is available.
export default function computeSnapTarget(args) {
  const snap = computeSnapCandidate(args);
  const { lockedPlane } = args;
  if (!snap?.position || !lockedPlane) return snap;
  return Math.abs(distanceToPlane(snap.position, lockedPlane)) <=
    LOCK_PLANE_EPS_M
    ? snap
    : null;
}

function distanceToPlane(position, { point, normal }) {
  return (
    (position.x - point.x) * normal.x +
    (position.y - point.y) * normal.y +
    (position.z - point.z) * normal.z
  );
}

function computeSnapCandidate({
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
  lockedPlane = null,
  axes = WORLD_AXES,
  intersectFallbackPlane = null,
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
      // On a locked face the point belongs to that face's annotation, even
      // on a vertex shared with a glued neighbor.
      nodeId: lockedPlane ? hit.nodeId : (snap.nodeId ?? hit.nodeId),
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
  const isOffLockedPlane = (position) =>
    Boolean(lockedPlane) &&
    Math.abs(distanceToPlane(position, lockedPlane)) > LOCK_PLANE_EPS_M;
  const snapFilter = {
    accept: (position) =>
      !isOffLockedPlane(position) && !isHiddenBySurface(position),
  };

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
    const edgeResult = { ...snap, ...frame, ...locked };
    // An edge snap that slid off the locked plane (along a crossing edge)
    // is no candidate: the cascade goes on to the plane under the cursor
    // rather than leaving the user with no target.
    if (!isOffLockedPlane(edgeResult.position)) {
      return withFaceUnderCursor(edgeResult);
    }
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
  // Fields of a plane hit carried by every snap derived from it.
  const hitTags = (hit) => ({
    ...(hit.axisKeys ? { axisKeys: hit.axisKeys } : {}),
    ...(hit.isNatural ? { isNatural: true } : {}),
  });
  // The hit itself, refined by vertex alignment.
  const refineHit = (hit) => {
    const aligned = alignPlaneHitToVertices({
      planeHit: hit,
      adjacency: alignAdjacency,
      extraPoints: inProgressPolyline,
      camera,
      canvasSize,
    });
    if (aligned) return { ...aligned, ...hitTags(hit) };
    return {
      position: hit.position,
      kind: hit.isFace ? "FACE" : "PLANE",
      baseMapId: hit.baseMapId,
      axisA: hit.axisA,
      axisB: hit.axisB,
      ...hitTags(hit),
    };
  };
  const refinePlaneHit = () => withFace(refineHit(planeHit));
  // In-plane ortho lock through the last vertex along the hit's axes, the
  // point then sliding along the locked line onto the coordinate of another
  // vertex: ortho from the last point AND aligned with e.g. the first one
  // (closing a rectangle). Null when the cursor is off both ortho lines.
  const orthoOnHit = (hit) => {
    const ortho = inPlaneOrthoSnap({
      planeHit: hit,
      lastVertex,
      mouseNdc,
      camera,
      canvasSize,
    });
    if (!ortho) return null;
    const aligned = alignPlaneHitToVertices({
      planeHit: {
        ...hit,
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
    if (!aligned) return { ...ortho, ...hitTags(hit) };
    return {
      ...ortho,
      position: aligned.position,
      lockedAxes: { A: true, B: true },
      axisA: aligned.axisA,
      axisB: aligned.axisB,
      alignFrom: aligned.alignFrom,
      ...hitTags(hit),
    };
  };

  if (!lastVertex) return planeHit ? refinePlaneHit() : null;

  if (planeHit) {
    const ortho = orthoOnHit(planeHit);
    if (ortho) return withFace(ortho);
  }

  const lastVec = new Vector3(lastVertex.x, lastVertex.y, lastVertex.z);
  const cursorDir = getCursorDir(mouseNdc, camera);

  let bestAxis = null;
  let bestDist = AXIS_THRESHOLD_PX;
  let bestPosition = null;
  for (const ax of planeHit?.isFace || lockedPlane ? [] : axes) {
    const pt = closestPointOnAxis(camera.position, cursorDir, lastVec, ax.dir);
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
  // Bound to a face: no point off it.
  if (lockedPlane) return null;

  // Nothing under the cursor: the natural plane of the drawing. Never fed to
  // getPlaneHit — it is no surface, it must neither occlude the vertices
  // behind it nor tag the point as a face point.
  const fallbackHit = intersectFallbackPlane?.(mouseNdc) ?? null;
  if (fallbackHit?.position) {
    return orthoOnHit(fallbackHit) ?? refineHit(fallbackHit);
  }

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
