import { useDispatch, useSelector } from "react-redux";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";
import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";
import {
  setSelectedItems,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { selectHiddenAnnotationTemplateIds } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { ORPHAN_TEMPLATE_ID } from "Features/annotations/utils/orphanAnnotations";

// ---------------------------------------------------------------------------
// useOrphanAnnotationsRow — actions of the « Annot. sans modèle » row
// (RowOrphanAnnotations): solo / eye of the orphan annotations through the
// orphan sentinel template id, and the click = select every orphan of the
// row on the map. Shared by PopperMapListings and the Dessin left panel.
// ---------------------------------------------------------------------------

export default function useOrphanAnnotationsRow() {
  const dispatch = useDispatch();

  // data

  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const hiddenIds = useSelector(selectHiddenAnnotationTemplateIds);

  // helpers

  const isSolo = soloTemplateId === ORPHAN_TEMPLATE_ID;
  const isHidden = hiddenIds.includes(ORPHAN_TEMPLATE_ID);

  // handlers

  const toggleSolo = () => {
    dispatch(setSoloAnnotationTemplateId(isSolo ? null : ORPHAN_TEMPLATE_ID));
  };

  const toggleHidden = () => {
    dispatch(toggleAnnotationTemplateHidden(ORPHAN_TEMPLATE_ID));
  };

  // Same item shape as the 2D lasso selection (InteractionLayer buildItem /
  // PanelTemplateAnnotations "Tout sél."). Eye-hidden orphans are un-hidden
  // first: the selection panels read the visible annotations only.
  const selectAll = (annotations) => {
    if (!annotations?.length) return;
    if (isHidden) dispatch(toggleAnnotationTemplateHidden(ORPHAN_TEMPLATE_ID));
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
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  return { isSolo, isHidden, toggleSolo, toggleHidden, selectAll };
}
