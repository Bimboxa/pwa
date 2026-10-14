import {
  setMoveAnnotationCopyBuffer,
  setMoveAnnotationRepeat,
} from "Features/threedEditor/threedEditorSlice";

import { withDefaultCopyCount } from "Features/annotationTransform/utils/copyBuffer";

import setMoveCopyBufferService from "./setMoveCopyBufferService";
import {
  getMoveAnnotationGrab,
  replayMoveOverlay,
} from "./moveAnnotationSessionStore";

// « Copier » (C / the helper's button) of the 3D « Déplacer » tool: one copy
// per click unless copies are already typed (withDefaultCopyCount), and
// « Recommencer à chaque clic » on. While carrying the buffer goes through
// setMoveCopyBufferService (ghosts, replay — and the revolution-axis
// refusal); armed, it is typed ahead in the slice for the next grab.
export default function armMoveCopyThreedService({ editor, store, dispatch }) {
  const grab = getMoveAnnotationGrab();
  const current =
    grab?.copyBuffer ??
    store.getState().threedEditor.moveAnnotationMode.copyBuffer ??
    "";
  const buffer = withDefaultCopyCount(current);
  if (grab) {
    setMoveCopyBufferService({ editor, buffer, dispatch });
  } else {
    dispatch(setMoveAnnotationCopyBuffer(buffer));
  }
  dispatch(setMoveAnnotationRepeat(true));
  // The badge shows the ↻ mark at once.
  replayMoveOverlay();
}
