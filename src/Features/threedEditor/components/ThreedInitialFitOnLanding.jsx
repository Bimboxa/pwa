import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setInitialFitDoneForScopeId } from "Features/viewers/viewersSlice";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// Initial camera framing of the Viewer module: once the annotations are
// loaded into the scene after a scope open, zoom out to a top-down view
// framing all of them (fitToAnnotationsTopDown). Runs ONCE per scope open —
// the done marker lives in redux (viewers.initialFitDoneForScopeId), not in a
// component ref: this component unmounts on every 2D toggle of the Viewer
// module, and a ref would re-arm the fit on each return to 3D. The marker is
// reset when the scope closes (dashboard round trip) so reopening fits again.
// Only active while the Viewer module displays its 3D editor — Dessin-3D /
// MESHES share the same MainThreedEditor instance and must never auto-fit.
// Lives as a child of MainThreedEditor so its re-renders don't re-render the
// parent (same pattern as ThreedAnnotationsVisibility).
export default function ThreedInitialFitOnLanding({
  threedEditorRef,
  rendererIsReady,
}) {
  const dispatch = useDispatch();

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const initialFitDoneForScopeId = useSelector(
    (s) => s.viewers.initialFitDoneForScopeId
  );
  const isViewerThreed = useSelector(
    (s) =>
      s.viewers.selectedViewerKey === "THREED" &&
      selectEffectiveViewerKey(s) === "THREED"
  );

  const settleTimerRef = useRef(null);

  useEffect(() => {
    // Dashboard round-trips null the scope: re-arm for the next open.
    if (!scopeId) dispatch(setInitialFitDoneForScopeId(null));
  }, [scopeId, dispatch]);

  useEffect(() => {
    if (!rendererIsReady || !isViewerThreed || !scopeId) return;
    if (initialFitDoneForScopeId === scopeId) return;
    const editor = threedEditorRef.current;
    const manager = editor?.sceneManager?.annotationsManager;
    if (!manager?.subscribeAnnotationReady) return;

    // Each ready batch re-arms the settle timer: the bulk create flushes once
    // with every id, then close async completions (GLB, CSG, resolved
    // profiles) land individually — fit only once the scene stops changing.
    let fired = false;
    const armSettle = () => {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        if (fired) return;
        fired = true;
        dispatch(setInitialFitDoneForScopeId(scopeId));
        editor.fitToAnnotationsTopDown?.();
      }, 600);
    };
    const unsubscribe = manager.subscribeAnnotationReady(armSettle);
    // Annotations already in the scene with no further ready event to come
    // (remount after an early 2D toggle): arm right away.
    if (Object.keys(manager.annotationsObjectsMap || {}).length) {
      armSettle();
    }
    // Zero-annotation scope: no ready event ever fires — after a grace
    // period, frame the fallback cube so the user still gets a settled view.
    const fallbackTimer = setTimeout(() => {
      if (!Object.keys(manager.annotationsObjectsMap || {}).length) {
        armSettle();
      }
    }, 2500);

    return () => {
      unsubscribe?.();
      clearTimeout(settleTimerRef.current);
      clearTimeout(fallbackTimer);
    };
  }, [
    rendererIsReady,
    isViewerThreed,
    scopeId,
    initialFitDoneForScopeId,
    threedEditorRef,
    dispatch,
  ]);

  return null;
}
