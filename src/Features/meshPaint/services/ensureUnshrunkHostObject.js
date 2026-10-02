import store from "App/store";

import { addShrinkExemptAnnotationIds } from "Features/meshPaint/meshPaintSlice";

// Default wait for the rebuilt object (React effect → loadAnnotations →
// possible async CSG carve).
const DEFAULT_TIMEOUT_MS = 3000;

// Annotations whose 3D build applies the anti-aliasing shrink
// (createAnnotationObject3D): walls with a real width (POLYLINE in CM —
// extrudeWallPolygon; a PX polyline is a thin sheet, never shrunk) and bands
// (STRIP). A mesh annotation is built from its stored faces, never shrunk.
export function isShrinkableAnnotation(annotation) {
  if (!annotation || annotation.isMesh3d || annotation._photoPlan3D) {
    return false;
  }
  if (annotation.type === "STRIP") return true;
  return annotation.type === "POLYLINE" && annotation.strokeWidthUnit === "CM";
}

// The object of this annotation is currently displayed shrunk.
export function isDisplayedShrunk(source, shrinkOn) {
  return Boolean(
    shrinkOn &&
    source &&
    !source._noAntiAliasingShrink &&
    isShrinkableAnnotation(source)
  );
}

function waitForObject({ annotationsManager, isReady, timeoutMs }) {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe = null;
    let timer = null;
    const finish = (timedOut) => {
      if (done) return;
      done = true;
      unsubscribe?.();
      if (timer) clearTimeout(timer);
      resolve({ timedOut });
    };
    unsubscribe =
      annotationsManager.subscribeAnnotationReady?.(() => {
        if (isReady()) finish(false);
      }) ?? null;
    timer = setTimeout(() => finish(true), timeoutMs);
    if (isReady()) finish(false);
  });
}

/**
 * Makes sure the 3D object of an annotation is its FINAL, un-shrunk one
 * before its geometry is read (painted part re-detection, conversion to a
 * mesh): « Réduire le crénelage des parements » pulls wall / band faces
 * 10 mm inward and their tops 5 mm down, which must never reach a measured
 * paint or a converted mesh.
 *
 * - Shrink setting on and the host shrinkable and not exempt yet: the host is
 *   exempted for the session (meshPaint.shrinkExemptAnnotationIds →
 *   useAutoLoadAnnotationsInThreedEditor rebuilds it alone) and the rebuilt
 *   object is awaited.
 * - In every case a pending CSG carve (AnnotationsManager.isCarvePending) is
 *   awaited: the first "ready" of a carved host is its uncarved object.
 *
 * Never throws; on timeout the current object is returned as is.
 *
 * exempt: false = only await a pending carve, never exempt the host (a probe
 * of the displayed object: a candidate the tool may not touch must not lose
 * its shrink for the session).
 *
 * @param {{editor: object, annotationId: string, timeoutMs?: number, exempt?: boolean}} params
 * @returns {Promise<{object: import("three").Object3D|null, rebuilt: boolean,
 *   timedOut: boolean, shrunk: boolean} | null>} null without a scene;
 *   shrunk: the returned object is still displayed shrunk.
 */
export default async function ensureUnshrunkHostObject({
  editor,
  annotationId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  exempt = true,
}) {
  const annotationsManager = editor?.sceneManager?.annotationsManager;
  if (!annotationsManager || !annotationId) return null;
  const getObject = () =>
    annotationsManager.annotationsObjectsMap?.[annotationId] ?? null;
  const isCarvePending = () =>
    Boolean(annotationsManager.isCarvePending?.(annotationId));

  const source = annotationsManager.getAnnotationSource?.(annotationId);
  const shrinkOn = Boolean(store.getState().threedEditor?.antiAliasingShrink);
  const displayedShrunk = isDisplayedShrunk(source, shrinkOn);
  const needsRebuild = exempt && displayedShrunk;
  const shrunk = displayedShrunk && !needsRebuild;

  if (!needsRebuild && !isCarvePending()) {
    return { object: getObject(), rebuilt: false, timedOut: false, shrunk };
  }

  if (needsRebuild) {
    store.dispatch(addShrinkExemptAnnotationIds([annotationId]));
  }

  const { timedOut } = await waitForObject({
    annotationsManager,
    timeoutMs,
    isReady: () => {
      if (!getObject()) return false;
      if (
        needsRebuild &&
        !annotationsManager.getAnnotationSource?.(annotationId)
          ?._noAntiAliasingShrink
      ) {
        return false;
      }
      return !isCarvePending();
    },
  });
  if (timedOut) {
    console.warn(
      `[ensureUnshrunkHostObject] ${annotationId}: object not rebuilt in ${timeoutMs} ms`
    );
  }
  return { object: getObject(), rebuilt: needsRebuild, timedOut, shrunk };
}
