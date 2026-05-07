import { Vector3 } from "three";

// Pixel threshold under which the cursor is considered "on" an axis line
// projected through the last committed vertex.
const AXIS_THRESHOLD_PX = 20;

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
//   3. snap to the world axis line (X / Y / Z) closest to the cursor
//      ray, anchored at the last committed vertex
//   4. fall back to a free position on the plane through the last vertex
//      perpendicular to the camera
//
// Returns { position, kind, meshKey?, axis? } or null when no candidate is
// available (no vertex snap and no last vertex to anchor axis/free modes).
export default function computeSnapTarget({
  mouseNdc,
  camera,
  canvasSize,
  lastVertex,
  inProgressPolyline,
  findNearestVertex,
}) {
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

  const vertexSnap = findNearestVertex(mouseNdc, camera, canvasSize);
  if (vertexSnap?.position) {
    return {
      position: vertexSnap.position,
      meshKey: vertexSnap.meshKey,
      kind: "VERTEX",
    };
  }

  if (!lastVertex) return null;

  const lastVec = new Vector3(lastVertex.x, lastVertex.y, lastVertex.z);
  const cursorDir = getCursorDir(mouseNdc, camera);

  let bestAxis = null;
  let bestDist = AXIS_THRESHOLD_PX;
  let bestPosition = null;
  for (const ax of AXES) {
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
