import { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

// Applies the annotation hide toggles to every annotation 3D object:
//   - global "Masquer les annotations" (threedEditor.hideAnnotationsIn3d,
//     set from the Maillage panel),
//   - main-basemap "Masquer les annotations" (hideMainBaseMapAnnotationsIn3d,
//     set from the basemap chips overlay / position panel). Non-main basemaps
//     don't need this path — their annotations are simply not loaded when
//     their mode is NONE.
// Lives as a child of MainThreedEditor so selection/toggle re-renders don't
// re-render the parent (which would re-fire useAutoLoadAnnotationsInThreedEditor
// — same trap as ThreedSelectionDimmer).
//
// Rendering only: three's raycaster ignores `visible`, so the picking paths
// (click, hover, lasso, meshing) filter hidden objects themselves — see
// filterIntersectionsByVisibility.
export default function ThreedAnnotationsVisibility({ threedEditorRef }) {
  const hideAnnotations = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const hideMainAnnotations = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const hideRef = useRef();
  hideRef.current = { hideAnnotations, hideMainAnnotations, mainBaseMapId };

  const applyToId = useCallback(
    (id) => {
      const manager = threedEditorRef.current?.sceneManager?.annotationsManager;
      const obj = manager?.annotationsObjectsMap?.[id];
      if (!obj) return;
      const { hideAnnotations, hideMainAnnotations, mainBaseMapId } =
        hideRef.current;
      const hidden =
        hideAnnotations ||
        (hideMainAnnotations && obj.userData?.baseMapId === mainBaseMapId);
      obj.visible = !hidden;
    },
    [threedEditorRef]
  );

  // Apply to every existing annotation when a toggle changes.
  useEffect(() => {
    const editor = threedEditorRef.current;
    const manager = editor?.sceneManager?.annotationsManager;
    if (!manager) return;
    Object.keys(manager.annotationsObjectsMap || {}).forEach(applyToId);
    editor.renderScene?.();
  }, [
    hideAnnotations,
    hideMainAnnotations,
    mainBaseMapId,
    applyToId,
    threedEditorRef,
  ]);

  // Re-apply when an annotation object is (re)created or finishes its async
  // GLB load — without this, objects rebuilt while hidden would pop back in.
  useEffect(() => {
    const editor = threedEditorRef.current;
    const manager = editor?.sceneManager?.annotationsManager;
    if (!manager?.subscribeAnnotationReady) return;
    return manager.subscribeAnnotationReady((id) => {
      applyToId(id);
      editor.renderScene?.();
    });
  }, [applyToId, threedEditorRef]);

  return null;
}
