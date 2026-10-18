import { useDispatch, useSelector } from "react-redux";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";
import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";

import { selectHiddenAnnotationTemplateIds } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { ORPHAN_TEMPLATE_ID } from "Features/annotations/utils/orphanAnnotations";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";

// ---------------------------------------------------------------------------
// useOrphanAnnotationsRow — actions of the « Annot. sans modèle » row
// (RowOrphanAnnotations): solo / eye of the orphan annotations through the
// orphan sentinel template id, and the click = select every orphan of the
// row on the map. Shared by PopperMapListings and the Dessin left panel.
// ---------------------------------------------------------------------------

export default function useOrphanAnnotationsRow() {
  const dispatch = useDispatch();
  const { selectAnnotations } = useSelectAnnotationsOnMap();

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

  // Eye-hidden orphans are un-hidden first: the selection panels read the
  // visible annotations only.
  const selectAll = (annotations) => {
    if (!annotations?.length) return;
    if (isHidden) dispatch(toggleAnnotationTemplateHidden(ORPHAN_TEMPLATE_ID));
    selectAnnotations(annotations);
  };

  return { isSolo, isHidden, toggleSolo, toggleHidden, selectAll };
}
