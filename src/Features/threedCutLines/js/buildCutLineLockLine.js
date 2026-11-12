import theme from "Styles/theme";

import { buildAxisLockLine } from "Features/threedDrawing/utils/axisLockLine";
import {
  buildSegments,
  getCanvasResolution,
  getDashSize,
  makeLineMaterial,
} from "Features/threedDrawing/utils/drawingOverlayLines";

const LINE_AXIS_COLOR = theme.palette.secondary.fluo ?? "#ff4d00";

// Dashed guide of a locked cut line gesture, through `origin` (world
// Vector3) along `axis.dir`: a user axis (`axis.user`, key X / Y / Z) takes
// the gizmo colour (buildAxisLockLine), a direction of the line itself (a
// connected segment, the perpendicular of a segment) the line's own colour.
// Not added to any scene; removed with removeAxisLockLine. Null when it
// cannot be built.
export default function buildCutLineLockLine({ editor, camera, origin, axis }) {
  if (!camera || !origin || !axis?.dir) return null;
  if (axis.user) {
    return buildAxisLockLine({
      editor,
      camera,
      origin,
      dir: axis.dir,
      axis: axis.key,
    });
  }
  const distance = camera.position.distanceTo(origin);
  const extent = Math.max(5, distance * 2);
  const mat = makeLineMaterial({
    color: LINE_AXIS_COLOR,
    linewidth: 1.5,
    dashed: true,
    dashSize: getDashSize(distance),
    resolution: getCanvasResolution(editor),
  });
  const line = buildSegments(
    [
      {
        a: origin.clone().addScaledVector(axis.dir, -extent),
        b: origin.clone().addScaledVector(axis.dir, extent),
      },
    ],
    mat
  );
  if (line) line.renderOrder = 1003;
  return line;
}
