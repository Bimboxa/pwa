import { setRotateAnnotationAngleBuffer } from "Features/threedEditor/threedEditorSlice";

import { parseTypedAngleDeg } from "Features/annotationTransform/utils/copyBuffer";

import applyRotateAnnotationsPose from "../utils/applyRotateAnnotationsPose";
import {
  buildCopyGhosts,
  disposeCopyGhosts,
  getGrabCopyCount,
} from "./moveCopyGhostsThreed";
import { getRotateAnnotationGrab } from "./rotateAnnotationSessionStore";

// Typed `<angle>[*<copies>]` buffer of the 3D « Tourner » tool (keyboard or
// the helper's field), rotation phase only: mirrors it to the slice, rebuilds
// the copy ghosts when the count changes (grab.carriedAnnotations — the
// resolved annotations snapped at the pivot click) and re-poses at once
// — the typed angle when it parses, else the current (mouse) one — so no
// pointer move is needed to see the change.
export default function setRotateAngleBufferService({
  editor,
  buffer,
  dispatch,
}) {
  const grab = getRotateAnnotationGrab();
  if (!grab || grab.refBearing == null) return;
  const prevCount = getGrabCopyCount(grab);
  grab.angleBuffer = buffer;
  dispatch(setRotateAnnotationAngleBuffer(buffer));
  const count = getGrabCopyCount(grab);
  if (count !== prevCount) {
    if (count > 0) buildCopyGhosts(editor, grab, grab.carriedAnnotations);
    else disposeCopyGhosts(grab);
  }
  const typedDeg = parseTypedAngleDeg(buffer);
  const phi = typedDeg == null ? grab.currentPhi : (typedDeg * Math.PI) / 180;
  applyRotateAnnotationsPose(editor, grab, phi);
}
