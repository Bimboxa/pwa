import {
  setMoveAnnotationCarriedIds,
  setMoveAnnotationCopyBuffer,
} from "Features/threedEditor/threedEditorSlice";

import buildMoveAnnotationGrab from "./buildMoveAnnotationGrab";
import { getMoveAnnotationGrab } from "./moveAnnotationSessionStore";

// How long the re-grab may wait for the AnnotationsManager to rebuild the
// moved annotations before giving up (the rebuild normally lands well
// before).
const REARM_FALLBACK_MS = 2500;

// « Recommencer à chaque clic » after a plain drop of the 3D « Déplacer »
// tool: the moved annotations are grabbed again at the destination. The
// commit rebuilds their 3D objects (fresh roots at identity, geometry baked
// at the new coordinates), so the grab-time poses of the current roots are
// stale: the re-grab waits for the rebuilt objects (subscribeAnnotationReady
// of every carried id, fallback delay) and only then builds the grab from
// them (buildMoveAnnotationGrab) — with the drop point as the grabbed point
// and the typed buffer kept. Nothing happens if the mode was left, the
// option was turned off, or a new grab was made meanwhile.
export default function rearmMoveAnnotationAfterCommit({
  editor,
  store,
  dispatch,
  annotationIds,
  baseMapId,
  dropWorld,
  copyBuffer,
  getAnnotations,
  isRevolutionAxis = false,
}) {
  const annotationsManager = editor?.sceneManager?.annotationsManager;
  const pending = new Set(annotationIds);
  let done = false;
  let unsubscribe = null;
  let timer = null;

  const rearm = () => {
    if (done) return;
    done = true;
    unsubscribe?.();
    if (timer) clearTimeout(timer);
    const mode = store.getState().threedEditor.moveAnnotationMode;
    if (!mode.active || !mode.repeat) return;
    if (getMoveAnnotationGrab()) return;
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    const carriedIds = buildMoveAnnotationGrab({
      editor,
      annotationIds,
      baseMapId,
      group,
      snapPosition: dropWorld,
      isRevolutionAxis,
      copyBuffer,
      annotations: getAnnotations?.() ?? [],
    });
    if (!carriedIds.length) return;
    dispatch(setMoveAnnotationCarriedIds(carriedIds));
    dispatch(setMoveAnnotationCopyBuffer(copyBuffer));
    editor?.renderScene?.();
  };

  if (!pending.size || !annotationsManager?.subscribeAnnotationReady) {
    rearm();
    return;
  }
  unsubscribe = annotationsManager.subscribeAnnotationReady((ids) => {
    for (const id of ids) pending.delete(id);
    if (!pending.size) rearm();
  });
  timer = setTimeout(rearm, REARM_FALLBACK_MS);
}
