import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "Features/annotations/annotationsSlice";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

export default function useDeleteAnnotationOnKeyboardInThreedEditor({
  annotations,
}) {
  const dispatch = useDispatch();
  const store = useStore();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName))
        return;

      const state = store.getState();
      // Effective key, not the raw module key: the shortcut follows the
      // editor actually displayed (e.g. the Dessin module toggled to 3D).
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;

      const selectedNode = state.selection.selectedItems.find(
        (item) => item.type === "NODE"
      );
      const nodeId = selectedNode?.nodeId;
      if (!nodeId) return;

      // Mailles (db.meshes3d) have no ownership guard — the annotation
      // permission check doesn't apply to them.
      const isMesh3d = selectedNode.nodeType === "MESH3D";
      if (!isMesh3d && !canEditAnnotation(nodeId)) return;

      dispatch(setOpenDialogDeleteSelectedAnnotation(true));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch, canEditAnnotation]);
}
