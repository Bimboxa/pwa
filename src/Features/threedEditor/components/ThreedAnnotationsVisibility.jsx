import { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

// Applies the "Masquer les annotations" toggle (threedEditor.hideAnnotationsIn3d,
// set from the Maillage panel) to every annotation 3D object. Lives as a child
// of MainThreedEditor so selection/toggle re-renders don't re-render the parent
// (which would re-fire useAutoLoadAnnotationsInThreedEditor — same trap as
// ThreedSelectionDimmer).
//
// Rendering only: three's raycaster ignores `visible`, so the picking paths
// (click, hover, lasso, meshing) filter hidden objects themselves — see
// filterIntersectionsByVisibility.
export default function ThreedAnnotationsVisibility({ threedEditorRef }) {
  const hideAnnotations = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );

  const hideRef = useRef(hideAnnotations);
  hideRef.current = hideAnnotations;

  const applyToId = useCallback(
    (id) => {
      const manager = threedEditorRef.current?.sceneManager?.annotationsManager;
      const obj = manager?.annotationsObjectsMap?.[id];
      if (obj) obj.visible = !hideRef.current;
    },
    [threedEditorRef]
  );

  // Apply to every existing annotation when the toggle changes.
  useEffect(() => {
    const editor = threedEditorRef.current;
    const manager = editor?.sceneManager?.annotationsManager;
    if (!manager) return;
    Object.keys(manager.annotationsObjectsMap || {}).forEach(applyToId);
    editor.renderScene?.();
  }, [hideAnnotations, applyToId, threedEditorRef]);

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
