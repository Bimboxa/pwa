import { useDispatch } from "react-redux";

import {
  setSelectedItems,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

// ---------------------------------------------------------------------------
// useSelectAnnotationsOnMap — select a set of annotations on the map from a
// list row (« Annot. sans modèle » orphans, « Annotations sans modèle »
// templateless draws): same item shape as the 2D lasso selection
// (InteractionLayer buildItem / PanelTemplateAnnotations "Tout sél."), then
// the multi-selection properties panel — unless `openProperties: false`
// (the « Annotations sans modèle » row click only selects on the map; its
// "Propriétés" button opens its own panel).
// ---------------------------------------------------------------------------

export default function useSelectAnnotationsOnMap() {
  const dispatch = useDispatch();

  // handlers

  const selectAnnotations = (annotations, { openProperties = true } = {}) => {
    if (!annotations?.length) return;
    const items = annotations.map((a) => ({
      id: a.id,
      nodeId: a.id,
      type: "NODE",
      nodeType: "ANNOTATION",
      annotationType: a.type,
      listingId: a.listingId,
      annotationTemplateId: a.annotationTemplateId,
      pointId: null,
      partId: null,
      partType: null,
    }));
    dispatch(setSelectedItems(items));
    if (items.length === 1) dispatch(setShowAnnotationsProperties(true));
    if (openProperties)
      dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  return { selectAnnotations };
}
