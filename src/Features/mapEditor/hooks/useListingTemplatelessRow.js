import { useDispatch, useSelector } from "react-redux";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";
import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";

import { selectHiddenAnnotationTemplateIds } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { getTemplatelessTemplateKey } from "Features/annotations/utils/templatelessAnnotations";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";

// ---------------------------------------------------------------------------
// useListingTemplatelessRow — actions of the « Sans modèle » row of a
// business-objects listing (RowListingTemplatelessAnnotations): solo / eye of
// the listing's templateless annotations through the per-listing templateless
// sentinel, and the click = select them all on the map. Twin of
// useOrphanAnnotationsRow.
// ---------------------------------------------------------------------------

export default function useListingTemplatelessRow({ listingId } = {}) {
  const dispatch = useDispatch();
  const { selectAnnotations } = useSelectAnnotationsOnMap();

  // data

  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const hiddenIds = useSelector(selectHiddenAnnotationTemplateIds);

  // helpers

  const key = getTemplatelessTemplateKey(listingId);
  const isSolo = soloTemplateId === key;
  const isHidden = hiddenIds.includes(key);

  // handlers

  const toggleSolo = () => {
    dispatch(setSoloAnnotationTemplateId(isSolo ? null : key));
  };

  const toggleHidden = () => {
    dispatch(toggleAnnotationTemplateHidden(key));
  };

  // Eye-hidden rows are un-hidden first: the selection panels read the
  // visible annotations only.
  const selectAll = (annotations) => {
    if (!annotations?.length) return;
    if (isHidden) dispatch(toggleAnnotationTemplateHidden(key));
    selectAnnotations(annotations);
  };

  return { isSolo, isHidden, toggleSolo, toggleHidden, selectAll };
}
