import { buildAxisLockLine, removeAxisLockLine } from "./axisLockLine";
import { closestPointOnAxis, ndcDistance } from "./computeSnapTarget";

// Axis lock of a 3D drag (label cards): the cursor is snapped on the axis
// through the grab point that is the closest to it on screen, and the locked
// axis is drawn as a dashed line in its colour. Shared by the annotation
// label drag (useAnnotationLabelDragHandlers) and the maille label drag
// (useMesh3dLabelDragHandlers).
//
// The drag state object carries: `axes` ([{ key, dir }], unit world
// directions), `startWorld` (world point the line is drawn through), `axis`
// (key of the drawn axis) and `axisLine` (the drawn line).

// Cursor snapped on the axis through `origin` closest to it on screen, within
// `thresholdPx` (CSS px; Infinity = always lock on the closest axis):
// { position, axis } or null. `ray` / `ndc` are the cursor ray and its NDC
// coordinates.
export function pickPointOnAxes({
  ray,
  ndc,
  camera,
  canvasSize,
  origin,
  axes,
  thresholdPx,
}) {
  if (!axes?.length || !origin) return null;
  let best = null;
  let bestDist = thresholdPx;
  for (const ax of axes) {
    const pt = closestPointOnAxis(ray.origin, ray.direction, origin, ax.dir);
    if (!pt) continue;
    const { distance, behind } = ndcDistance(pt, ndc, camera, canvasSize);
    if (behind || distance >= bestDist) continue;
    bestDist = distance;
    best = { position: pt, axis: ax.key };
  }
  return best;
}

export function clearAxisLockLine(drag) {
  if (!drag?.axisLine) return;
  removeAxisLockLine(drag.axisLine);
  drag.axisLine = null;
  drag.axis = null;
}

// Draw (or clear, when `axis` is null) the dashed line along the locked axis
// through `drag.startWorld`. Static for a given axis.
export function updateAxisLockLine(drag, axis, { editor, camera, scene }) {
  if (!axis) {
    clearAxisLockLine(drag);
    return;
  }
  if (drag.axis === axis && drag.axisLine) return;
  clearAxisLockLine(drag);
  const dir = drag.axes.find((a) => a.key === axis)?.dir;
  if (!dir) return;
  const line = buildAxisLockLine({
    editor,
    camera,
    origin: drag.startWorld,
    dir,
    axis,
  });
  if (!line) return;
  scene.add(line);
  drag.axisLine = line;
  drag.axis = axis;
}
