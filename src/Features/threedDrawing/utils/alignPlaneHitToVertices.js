import { Vector3 } from "three";

// Screen threshold of the alignment lock (tighter than the 12 px vertex snap
// so alignment never fights it), and minimum in-plane screen distance to the
// aligned vertex — alignment is a DISTANT-point assist, mirroring the 2D
// axis snap (getAxisSnap), not a duplicate of the vertex snap.
export const ALIGN_THRESHOLD_PX = 8;
export const MIN_VERTEX_DISTANCE_PX = 24;

// Two vertices (almost) equally close to an arm: the one nearest to the
// cursor carries the lock — same tie-break as the 2D axis snap.
export const TIE_PX = 0.5;

const SLIDE_AXES_BOTH = ["A", "B"];

function translateAxis(axis, delta) {
  return [axis[0].clone().add(delta), axis[1].clone().add(delta)];
}

// Align the plane hit with existing vertices along the hovered plane's own
// axes: the snapped point shares one in-plane coordinate (along axisA or
// axisB) with a vertex, so that arm of the cross helper runs through it.
// In-plane analog of the 2D distant-point axis snap — like it, both arms can
// lock at once, each on its own vertex.
//
// Candidates are the nodes of the mesh adjacency published by useVertexSnap
// plus `extraPoints` ({x, y, z} — the points of the drawing in progress).
// Their off-plane component is ignored, so e.g. a wall-top vertex aligns
// through its plan footprint.
//
// `slideAxes` lists the axes the point may move along. A point already
// locked on a line (in-plane ortho lock along axis "A") only slides along
// it: `slideAxes: ["A"]`. Distances are measured on screen from
// `planeHit.position` — the point under the cursor for a raw plane hit.
//
// Returns { position, kind: "PLANE_ALIGN", axis: "A"|"B", lockedAxes: {A, B},
// baseMapId, axisA, axisB, alignFrom } or null. `axisA` / `axisB` are
// translated through the snapped point, `lockedAxes` flags the arms running
// through an aligned vertex (`axis` is the tightest one) and `alignFrom`
// lists those vertices as { position, footprint } (world position and its
// projection in the plane).
export default function alignPlaneHitToVertices({
  planeHit,
  adjacency,
  extraPoints = null,
  slideAxes = SLIDE_AXES_BOTH,
  camera,
  canvasSize,
  thresholdPx = ALIGN_THRESHOLD_PX,
}) {
  if (!planeHit?.position || !planeHit.axisA || !planeHit.axisB) return null;
  if (!adjacency?.size && !extraPoints?.length) return null;
  if (!camera || !canvasSize) return null;

  const dirA = planeHit.axisA[1].clone().sub(planeHit.axisA[0]);
  const dirB = planeHit.axisB[1].clone().sub(planeHit.axisB[0]);
  if (dirA.lengthSq() < 1e-12 || dirB.lengthSq() < 1e-12) return null;
  dirA.normalize();
  dirB.normalize();

  const hit = planeHit.position;
  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;

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

  const canSlideA = slideAxes.includes("A");
  const canSlideB = slideAxes.includes("B");

  // Best lock per cross arm.
  const best = { A: null, B: null };

  const consider = (offsetM, dir, axis, vertex, approxPx) => {
    if (approxPx >= thresholdPx * 2) return;
    const candidate = hit.clone().addScaledVector(dir, offsetM);
    const s = project(candidate);
    if (!s) return;
    const distance = Math.hypot(s.x - hitScreen.x, s.y - hitScreen.y);
    if (distance >= thresholdPx) return;
    const current = best[axis];
    const isBetter =
      !current ||
      distance < current.distance - TIE_PX ||
      (distance <= current.distance + TIE_PX &&
        vertex.footprintPx < current.footprintPx);
    if (!isBetter) return;
    best[axis] = {
      dir,
      offsetM,
      distance,
      footprintPx: vertex.footprintPx,
      u: vertex.u,
      v: vertex.v,
      position: new Vector3(vertex.x, vertex.y, vertex.z),
    };
  };

  const d = new Vector3();
  const visit = (p) => {
    d.set(p.x, p.y, p.z).sub(hit);
    const u = d.dot(dirA);
    const v = d.dot(dirB);
    const footprintPx = Math.hypot(u * pxmA, v * pxmB);
    // Distant-point rule: skip vertices whose plan footprint is (almost)
    // under the cursor — the vertex snap owns that zone.
    if (footprintPx < MIN_VERTEX_DISTANCE_PX) return;
    const vertex = { x: p.x, y: p.y, z: p.z, u, v, footprintPx };
    // Share the axisA coordinate with the vertex: the point slides along
    // axisA and the alignment line (vertex -> point) runs along axisB — the
    // B arm locks. And vice versa.
    if (canSlideA) consider(u, dirA, "B", vertex, Math.abs(u) * pxmA);
    if (canSlideB) consider(v, dirB, "A", vertex, Math.abs(v) * pxmB);
  };

  if (adjacency) for (const node of adjacency.values()) visit(node.position);
  if (extraPoints) for (const p of extraPoints) visit(p);

  const locks = [best.A, best.B].filter(Boolean);
  if (!locks.length) return null;

  const delta = new Vector3();
  locks.forEach((lock) => delta.addScaledVector(lock.dir, lock.offsetM));

  const tightest =
    best.A && (!best.B || best.A.distance <= best.B.distance) ? "A" : "B";

  return {
    position: hit.clone().add(delta),
    kind: "PLANE_ALIGN",
    axis: tightest,
    lockedAxes: { A: Boolean(best.A), B: Boolean(best.B) },
    baseMapId: planeHit.baseMapId,
    axisA: translateAxis(planeHit.axisA, delta),
    axisB: translateAxis(planeHit.axisB, delta),
    alignFrom: locks.map((lock) => ({
      position: lock.position,
      footprint: hit
        .clone()
        .addScaledVector(dirA, lock.u)
        .addScaledVector(dirB, lock.v),
    })),
  };
}
