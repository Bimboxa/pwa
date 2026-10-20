import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

// ---------------------------------------------------------------------------
// useOpenTemplatelessAnnotationsPanel — "Propriétés" of the « Annotations
// sans modèle » rows (Dessin popper / docked Dessin panel): opens the right
// panel on PanelTemplatelessAnnotations (selection item
// TEMPLATELESS_ANNOTATIONS, keyed by the selected scope).
// ---------------------------------------------------------------------------

export default function useOpenTemplatelessAnnotationsPanel() {
  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  return () => {
    dispatch(
      setSelectedItem({
        id: selectedScopeId ?? "TEMPLATELESS_ANNOTATIONS",
        type: "TEMPLATELESS_ANNOTATIONS",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };
}
