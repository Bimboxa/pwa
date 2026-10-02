import { Vector3 } from "three";

import {
  ALIGN_THRESHOLD_PX,
  MIN_VERTEX_DISTANCE_PX,
  TIE_PX,
} from "./alignPlaneHitToVertices.js";
import { ORTHO_THRESHOLD_PX } from "./inPlaneOrthoSnap.js";

// Relative tolerance under which the edge runs perpendicular to a lock
// direction: sliding along it never changes that coordinate.
const PARALLEL_EPS = 1e-6;
// Two points closer than this (m) are the same point.
const SAME_POINT_EPS_M = 1e-6;

function translateAxis(axis, delta) {
  return [axis[0].clone().add(delta), axis[1].clone().add(delta)];
}

// Axis snap of a point snapped ON an edge: the point only slides along the
// edge, and stops where an arm of the cross helper (axisA / axisB, already
// passing through `position`) runs through
//   - the last vertex: ortho segment from it (`ORTHO_THRESHOLD_PX` corridor,
//     like inPlaneOrthoSnap — no marker, the last point is in sight);
//   - another vertex (`adjacency` nodes + `extraPoints`): alignment, like
//     alignPlaneHitToVertices (`ALIGN_THRESHOLD_PX`, distant-point rule,
//     same tie-break) — reported in `alignFrom` for the marker.
// Off-plane vertices align through their footprint in the cross plane.
//
// Distances are measured on screen from `position` (the edge point under
// the cursor). One degree of freedom: a single lock at a time.
//
// Returns { position, axis: "A"|"B", lockedAxes: {A, B}, axisA, axisB,
// alignFrom: [{ position, footprint }] } (cross axes translated through the
// locked point) or null when no lock applies.
export default function lockEdgeSnapToAxes({
  edge,
  position,
  axisA,
  axisB,
  lastVertex = null,
  adjacency = null,
  extraPoints = null,
  camera,
  canvasSize,
}) {
  if (!edge || !position || !axisA || !axisB || !camera || !canvasSize)
    return null;

  const dirA = axisA[1].clone().sub(axisA[0]);
  const dirB = axisB[1].clone().sub(axisB[0]);
  if (dirA.lengthSq() < 1e-12 || dirB.lengthSq() < 1e-12) return null;
  dirA.normalize();
  dirB.normalize();
  const normal = dirA.clone().cross(dirB);
  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();

  const [start, end] = edge;
  const edgeVec = end.clone().sub(start);
  const edgeLength = edgeVec.length();
  if (edgeLength < 1e-9) return null;

  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const project = (world) => {
    const p = world.clone().project(camera);
    if (p.z < -1 || p.z > 1) return null;
    return { x: p.x * halfW, y: p.y * halfH };
  };
  const atScreen = project(position);
  if (!atScreen) return null;

  // Px per edge parameter unit around `position` — a cheap prefilter before
  // the exact projection of a candidate (0: no prefilter).
  const sAt = position.clone().sub(start).dot(edgeVec) / edgeLength ** 2;
  const stepS = sAt < 0.5 ? 0.01 : -0.01;
  const stepScreen = project(
    start.clone().addScaledVector(edgeVec, sAt + stepS)
  );
  const pxPerS = stepScreen
    ? Math.hypot(stepScreen.x - atScreen.x, stepScreen.y - atScreen.y) /
      Math.abs(stepS)
    : 0;

  let best = null;

  const consider = (point, thresholdPx, isOrtho) => {
    const vertex = new Vector3(point.x, point.y, point.z);
    // Sharing the coordinate along `dir` with the vertex: the segment
    // vertex -> point runs along the OTHER axis, whose arm locks.
    for (const [dir, arm] of [
      [dirA, "B"],
      [dirB, "A"],
    ]) {
      const denom = edgeVec.dot(dir);
      if (Math.abs(denom) < PARALLEL_EPS * edgeLength) continue;
      const s = vertex.clone().sub(start).dot(dir) / denom;
      if (s < 0 || s > 1) continue;
      if (Math.abs(s - sAt) * pxPerS >= thresholdPx * 2) continue;
      const candidate = start.clone().addScaledVector(edgeVec, s);
      const candidateScreen = project(candidate);
      if (!candidateScreen) continue;
      const distance = Math.hypot(
        candidateScreen.x - atScreen.x,
        candidateScreen.y - atScreen.y
      );
      if (distance >= thresholdPx) continue;
      // Distant-point rule: the vertex (its footprint in the cross plane)
      // must not sit on the locked point — the vertex snap owns that zone,
      // and an ortho lock from a last vertex lying on the edge is void.
      const footprint = vertex
        .clone()
        .addScaledVector(normal, -vertex.clone().sub(candidate).dot(normal));
      const footprintScreen = project(footprint);
      if (!footprintScreen) continue;
      const footprintPx = Math.hypot(
        footprintScreen.x - candidateScreen.x,
        footprintScreen.y - candidateScreen.y
      );
      if (footprintPx < MIN_VERTEX_DISTANCE_PX) continue;
      const isBetter =
        !best ||
        distance < best.distance - TIE_PX ||
        (distance <= best.distance + TIE_PX && footprintPx < best.footprintPx);
      if (!isBetter) continue;
      best = {
        candidate,
        arm,
        distance,
        footprintPx,
        vertex,
        footprint,
        isOrtho,
      };
    }
  };

  const isLastVertex = (p) =>
    lastVertex &&
    Math.abs(p.x - lastVertex.x) < SAME_POINT_EPS_M &&
    Math.abs(p.y - lastVertex.y) < SAME_POINT_EPS_M &&
    Math.abs(p.z - lastVertex.z) < SAME_POINT_EPS_M;

  if (lastVertex) consider(lastVertex, ORTHO_THRESHOLD_PX, true);
  if (adjacency) {
    for (const node of adjacency.values()) {
      if (!isLastVertex(node.position))
        consider(node.position, ALIGN_THRESHOLD_PX, false);
    }
  }
  if (extraPoints) {
    for (const p of extraPoints) {
      if (!isLastVertex(p)) consider(p, ALIGN_THRESHOLD_PX, false);
    }
  }

  if (!best) return null;

  const delta = best.candidate.clone().sub(position);
  return {
    position: best.candidate,
    axis: best.arm,
    lockedAxes: { A: best.arm === "A", B: best.arm === "B" },
    axisA: translateAxis(axisA, delta),
    axisB: translateAxis(axisB, delta),
    alignFrom: best.isOrtho
      ? []
      : [{ position: best.vertex, footprint: best.footprint }],
  };
}
