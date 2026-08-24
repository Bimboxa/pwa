import { Vector3 } from "three";

// Closest vertex to the cursor in screen space, over an explicit verts list
// ([{position: Vector3, meshKey}] — same shape as useVertexSnap's index).
// Used by the "Déplacer" tool with the target-only index built at grab time.
export default function findNearestVertexInVerts(
  verts,
  mouseNdc,
  camera,
  canvasSize,
  pixelThreshold = 12
) {
  if (!verts?.length || !camera || !canvasSize) return null;

  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const mouseX = mouseNdc.x * halfW;
  const mouseY = mouseNdc.y * halfH;

  let best = null;
  let bestSq = pixelThreshold * pixelThreshold;
  const tmp = new Vector3();
  for (const v of verts) {
    tmp.copy(v.position).project(camera);
    if (tmp.z < -1 || tmp.z > 1) continue;
    const dx = tmp.x * halfW - mouseX;
    const dy = tmp.y * halfH - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestSq) {
      bestSq = d2;
      best = v;
    }
  }
  if (!best) return null;
  return { position: best.position.clone(), kind: "VERTEX" };
}
