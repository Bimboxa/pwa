// Screen threshold of the alignment lock (tighter than the 12 px vertex snap
// so alignment never fights it), and minimum in-plane screen distance to the
// aligned vertex — alignment is a DISTANT-point assist, mirroring the 2D
// axis snap (getAxisSnap), not a duplicate of the vertex snap.
const ALIGN_THRESHOLD_PX = 8;
const MIN_VERTEX_DISTANCE_PX = 24;

function translateAxis(axis, delta) {
  return [axis[0].clone().add(delta), axis[1].clone().add(delta)];
}

// Align the plane hit with an existing scene vertex along the hovered base
// map plane's own axes: the snapped point shares one image-space coordinate
// (along axisA or axisB) with the vertex. In-plane analog of the 2D
// distant-point axis snap. Candidates come from the mesh adjacency published
// by useVertexSnap; their off-plane component is ignored, so e.g. a wall-top
// vertex aligns through its plan footprint.
//
// Returns { position, kind: "PLANE_ALIGN", axis: "A"|"B", baseMapId, axisA,
// axisB, alignFrom } (axes translated through the snapped point, `alignFrom`
// the world position of the aligned vertex) or null.
export default function alignPlaneHitToVertices({
  planeHit,
  adjacency,
  mouseNdc,
  camera,
  canvasSize,
  thresholdPx = ALIGN_THRESHOLD_PX,
}) {
  if (!planeHit?.position || !planeHit.axisA || !planeHit.axisB) return null;
  if (!adjacency?.size || !camera || !canvasSize) return null;

  const dirA = planeHit.axisA[1].clone().sub(planeHit.axisA[0]);
  const dirB = planeHit.axisB[1].clone().sub(planeHit.axisB[0]);
  if (dirA.lengthSq() < 1e-12 || dirB.lengthSq() < 1e-12) return null;
  dirA.normalize();
  dirB.normalize();

  const hit = planeHit.position;
  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const mouseX = mouseNdc.x * halfW;
  const mouseY = mouseNdc.y * halfH;

  const project = (world) => {
    const p = world.clone().project(camera);
    if (p.z < -1 || p.z > 1) return null;
    return { x: p.x * halfW, y: p.y * halfH };
  };

  const hitScreen = project(hit);
  if (!hitScreen) return null;

  // Px-per-metre along each in-plane axis, estimated at the hit point — used
  // as a cheap prefilter before the exact projection of a candidate.
  const pxPerMeter = (dir) => {
    const s = project(hit.clone().add(dir));
    if (!s) return null;
    return Math.hypot(s.x - hitScreen.x, s.y - hitScreen.y);
  };
  const pxmA = pxPerMeter(dirA);
  const pxmB = pxPerMeter(dirB);
  if (!pxmA || !pxmB) return null;

  let best = null;

  const consider = (offsetM, dir, axis, node, approxPx) => {
    if (approxPx >= thresholdPx * 2) return;
    const candidate = hit.clone().add(dir.clone().multiplyScalar(offsetM));
    const s = project(candidate);
    if (!s) return;
    const distance = Math.hypot(s.x - mouseX, s.y - mouseY);
    if (distance >= thresholdPx) return;
    if (!best || distance < best.distance) {
      best = { candidate, axis, distance, alignFrom: node.position.clone() };
    }
  };

  for (const node of adjacency.values()) {
    const d = node.position.clone().sub(hit);
    const u = d.dot(dirA);
    const v = d.dot(dirB);
    // Distant-point rule: skip vertices whose plan footprint is (almost)
    // under the cursor — the vertex snap owns that zone.
    if (Math.hypot(u * pxmA, v * pxmB) < MIN_VERTEX_DISTANCE_PX) continue;
    // Share the axisA coordinate with the vertex: the alignment line
    // (vertex -> candidate) runs along axisB, and vice versa.
    consider(u, dirA, "B", node, Math.abs(u) * pxmA);
    consider(v, dirB, "A", node, Math.abs(v) * pxmB);
  }
  if (!best) return null;

  const delta = best.candidate.clone().sub(hit);
  return {
    position: best.candidate,
    kind: "PLANE_ALIGN",
    axis: best.axis,
    baseMapId: planeHit.baseMapId,
    axisA: translateAxis(planeHit.axisA, delta),
    axisB: translateAxis(planeHit.axisB, delta),
    alignFrom: best.alignFrom,
  };
}
