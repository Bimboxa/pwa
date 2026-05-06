import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setOpenDialogDeleteSelectedAnnotation } from "Features/annotations/annotationsSlice";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";

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
      if (state.viewers.selectedViewerKey !== "THREED") return;

      const selectedNode = state.selection.selectedItems.find(
        (item) => item.type === "NODE"
      );
      const nodeId = selectedNode?.nodeId;
      if (!nodeId) return;

      if (!canEditAnnotation(nodeId)) return;

      dispatch(setOpenDialogDeleteSelectedAnnotation(true));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch, canEditAnnotation]);
}
