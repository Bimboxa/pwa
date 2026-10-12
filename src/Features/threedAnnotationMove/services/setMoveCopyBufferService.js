import { setMoveAnnotationCopyBuffer } from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getBufferValuePart } from "Features/annotationTransform/utils/copyBuffer";
import { MULTI_COPY_UNSUPPORTED_MESSAGE } from "Features/annotationTransform/constants/transformToolStrings";

import { poseCarriedAnnotations } from "../utils/applyMoveAnnotationsPose";
import {
  buildCopyGhosts,
  disposeCopyGhosts,
  getGrabCopyCount,
  poseCopyGhosts,
} from "./moveCopyGhostsThreed";
import {
  getMoveAnnotationGrab,
  replayMoveOverlay,
} from "./moveAnnotationSessionStore";

const ZERO_DELTA = { x: 0, y: 0, z: 0 };

// Typed `<distance>[*<copies>]` buffer of the 3D « Déplacer » tool (keyboard
// or the helper's fields) while an annotation is carried: mirrors it to the
// slice, rebuilds the copy ghosts when the count changes (swapping what
// follows the cursor: ghosts vs the originals, at the last applied delta)
// and replays the overlay so the pose and the badge follow the typed
// distance at once — no pointer move needed. A revolution axis is never
// copied: its `*N` tail is refused with a toast.
export default function setMoveCopyBufferService({ editor, buffer, dispatch }) {
  const grab = getMoveAnnotationGrab();
  if (!grab) return;
  let next = buffer ?? "";
  if (grab.isRevolutionAxis && next.includes("*")) {
    dispatch(
      setToaster({
        message: MULTI_COPY_UNSUPPORTED_MESSAGE,
        severity: "warning",
      })
    );
    next = getBufferValuePart(next);
  }
  const prevCount = getGrabCopyCount(grab);
  grab.copyBuffer = next;
  dispatch(setMoveAnnotationCopyBuffer(next));
  const count = getGrabCopyCount(grab);
  if (count !== prevCount) {
    if (count > 0) {
      if (prevCount === 0) poseCarriedAnnotations(editor, grab, ZERO_DELTA);
      buildCopyGhosts(editor, grab, grab.carriedAnnotations);
      poseCopyGhosts(grab, grab.lastDelta ?? ZERO_DELTA);
    } else {
      disposeCopyGhosts(grab);
      poseCarriedAnnotations(editor, grab, grab.lastDelta ?? ZERO_DELTA);
    }
  }
  replayMoveOverlay();
  editor?.renderScene?.();
}
