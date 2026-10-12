import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import {
  disposeObject,
  getCanvasResolution,
} from "Features/threedDrawing/utils/drawingOverlayLines";

import { parseCopyCount } from "Features/annotationTransform/utils/copyBuffer";

// « Copie multiple » ghosts of the 3D « Déplacer » tool: one fresh 3D object
// per (copy, carried annotation), built from the resolved annotation like
// the real objects (createAnnotationObject3D — never a clone of the real
// root: Object3D.copy serialises userData, which holds materials and dispose
// callbacks, and fat lines would leak their constructor defaults). The
// ghosts own their geometry and materials, so disposeObject is safe.
//
// A ghost is a child of the base map group (local metre frame), posed at the
// carried root's grab-time position + i × delta. Its userData is replaced by
// { isCopyGhost: true }: no nodeType, so picking ignores it and buildIndex
// skips it (useVertexSnap).
//
// grab.ghosts: [{ index, annotationId, object, start: Vector3 }]

// How long the ghosts may stand in for the written copies after the drop
// before being dropped anyway (the rebuild normally lands well before).
const HOLD_FALLBACK_MS = 2500;

export function getGrabCopyCount(grab) {
  return parseCopyCount(grab?.copyBuffer ?? "");
}

export function disposeCopyGhosts(grab) {
  if (!grab?.ghosts?.length) return;
  for (const ghost of grab.ghosts) {
    ghost.object.parent?.remove(ghost.object);
    disposeObject(ghost.object);
  }
  grab.ghosts = [];
}

// Rebuilds the ghosts for the current copy count of the grab (annotations:
// the resolved list the tool holds). Disposes the previous set.
export function buildCopyGhosts(editor, grab, annotations) {
  disposeCopyGhosts(grab);
  const count = getGrabCopyCount(grab);
  if (!count) return;
  const imagesManager = editor?.sceneManager?.imagesManager;
  const group = imagesManager?.getGroup(grab.baseMapId);
  const metrics = getBaseMapForRender(
    imagesManager?.baseMapsMap?.[grab.baseMapId]
  );
  if (!group || !metrics) return;
  const resolution = getCanvasResolution(editor);

  const ghosts = [];
  for (let i = 1; i <= count; i++) {
    for (const annotationId of grab.annotationIds) {
      const start = grab.rootStartPoses.get(annotationId)?.position;
      const annotation = annotations?.find((a) => a.id === annotationId);
      if (!start || !annotation) continue;
      let object = null;
      try {
        object = createAnnotationObject3D(annotation, metrics, { resolution });
      } catch (err) {
        console.warn("[threedAnnotationMove] copy ghost build failed", err);
      }
      if (!object) continue;
      object.userData = { isCopyGhost: true };
      group.add(object);
      ghosts.push({ index: i, annotationId, object, start: start.clone() });
    }
  }
  grab.ghosts = ghosts;
}

// Poses every ghost at start + index × delta (local metres). Does not render.
export function poseCopyGhosts(grab, delta) {
  for (const ghost of grab?.ghosts ?? []) {
    ghost.object.position.set(
      ghost.start.x + delta.x * ghost.index,
      ghost.start.y + delta.y * ghost.index,
      ghost.start.z + delta.z * ghost.index
    );
  }
}

// After the drop: the ghosts keep standing for the written copies until the
// AnnotationsManager has built them (annotation-ready notifications carry
// ARRAYS of ids), or the fallback delay. Takes the ghosts over from the grab.
export function holdCopyGhostsUntilBuilt(editor, grab, newAnnotationIds) {
  const ghosts = grab?.ghosts ?? [];
  grab.ghosts = [];
  if (!ghosts.length) return;
  const annotationsManager = editor?.sceneManager?.annotationsManager;
  const pending = new Set(newAnnotationIds ?? []);
  let released = false;
  let unsubscribe = null;
  let timer = null;

  const release = () => {
    if (released) return;
    released = true;
    unsubscribe?.();
    if (timer) clearTimeout(timer);
    for (const ghost of ghosts) {
      ghost.object.parent?.remove(ghost.object);
      disposeObject(ghost.object);
    }
    editor?.renderScene?.();
  };

  if (!pending.size || !annotationsManager?.subscribeAnnotationReady) {
    release();
    return;
  }
  unsubscribe = annotationsManager.subscribeAnnotationReady((ids) => {
    for (const id of ids) pending.delete(id);
    if (!pending.size) release();
  });
  timer = setTimeout(release, HOLD_FALLBACK_MS);
}
