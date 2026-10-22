import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

import {
  buildSegments,
  disposeObject,
  getCanvasResolution,
  getDashSize,
  makeLineMaterial,
} from "./drawingOverlayLines";

// Dashed line drawn along a user axis (X / Y / Z of the gizmo frame) while a
// drag is locked on it — through the grab point, in the axis colour, the
// drawing overlay look. Shared by the 3D label-card drag
// (useAnnotationLabelDragHandlers) and the cote value drag
// (useCoteLabelDragHandlers).

// Half-length (m, at least) and screen thickness of the line.
const AXIS_LOCK_LINE_MIN_EXTENT_M = 5;
const AXIS_LOCK_LINE_WIDTH_PX = 1.5;
// Above the drawn geometry and the other overlay lines.
const AXIS_LOCK_LINE_RENDER_ORDER = 1003;

// A LineSegments2 along `dir` (unit Vector3) through `origin` (world
// Vector3), long enough to cross the view from the camera's distance. Not
// added to any scene. Null when the line cannot be built.
export function buildAxisLockLine({ editor, camera, origin, dir, axis }) {
  if (!camera || !origin || !dir) return null;
  const distance = camera.position.distanceTo(origin);
  const extent = Math.max(AXIS_LOCK_LINE_MIN_EXTENT_M, distance * 2);
  const mat = makeLineMaterial({
    color: AXIS_COLORS[axis],
    linewidth: AXIS_LOCK_LINE_WIDTH_PX,
    dashed: true,
    dashSize: getDashSize(distance),
    resolution: getCanvasResolution(editor),
  });
  const line = buildSegments(
    [
      {
        a: origin.clone().addScaledVector(dir, -extent),
        b: origin.clone().addScaledVector(dir, extent),
      },
    ],
    mat
  );
  if (!line) return null;
  line.renderOrder = AXIS_LOCK_LINE_RENDER_ORDER;
  return line;
}

// Detach the line from its parent and free its GPU resources.
export function removeAxisLockLine(line) {
  if (!line) return;
  line.parent?.remove(line);
  disposeObject(line);
}
