import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import {
  disposeObject,
  getCanvasResolution,
} from "Features/threedDrawing/utils/drawingOverlayLines";

import {
  parseCopyCount,
  parseMoveLength,
} from "Features/annotationTransform/utils/copyBuffer";

// « Copie multiple » ghosts of the 3D « Déplacer » / « Tourner » tools: one
// fresh 3D object per (copy, carried annotation), built from the resolved
// annotation like
// the real objects (createAnnotationObject3D — never a clone of the real
// root: Object3D.copy serialises userData, which holds materials and dispose
// callbacks, and fat lines would leak their constructor defaults). The
// ghosts own their geometry and materials, so disposeObject is safe.
//
// A ghost is a child of the base map group (local metre frame), posed from
// the carried root's grab-time pose: + i × delta (poseCopyGhosts, move) or
// turned by i × phi around the pivot (poseCopyGhostsRotated, rotate). Its
// userData is replaced by { isCopyGhost: true }: no nodeType, so picking
// ignores it and buildIndex skips it (useVertexSnap).
//
// grab.ghosts: [{ index, annotationId, object, start: Vector3, startRotZ }]
// The copy count comes from the grab's typed buffer: `copyBuffer`
// (`<distance>[*<copies>]`, move) or `angleBuffer` (`<angle>[*<copies>]`,
// rotate).

// How long the ghosts may stand in for the written copies after the drop
// before being dropped anyway (the rebuild normally lands well before).
const HOLD_FALLBACK_MS = 2500;

export function getGrabCopyCount(grab) {
  return parseCopyCount(grab?.copyBuffer ?? grab?.angleBuffer ?? "");
}

// Typed distance of the grab (metres), or null.
export function getGrabMoveLength(grab) {
  return parseMoveLength(grab?.copyBuffer ?? "");
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
      const startPose = grab.rootStartPoses.get(annotationId);
      const start = startPose?.position;
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
      const startRotZ = startPose.rotZ || 0;
      object.position.copy(start);
      object.rotation.z = startRotZ;
      group.add(object);
      ghosts.push({
        index: i,
        annotationId,
        object,
        start: start.clone(),
        startRotZ,
      });
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

// Poses every ghost turned by index × phi (rad) about the base map plane's
// normal (local +Z) through grab.pivotLocal — same composition as
// applyRotateAnnotationsPose. Does not render.
export function poseCopyGhostsRotated(grab, phi) {
  const pivot = grab?.pivotLocal;
  if (!pivot) return;
  for (const ghost of grab.ghosts ?? []) {
    const angle = phi * ghost.index;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = ghost.start.x - pivot.x;
    const dy = ghost.start.y - pivot.y;
    ghost.object.position.set(
      pivot.x + dx * cos - dy * sin,
      pivot.y + dx * sin + dy * cos,
      ghost.start.z
    );
    ghost.object.rotation.z = ghost.startRotZ + angle;
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
