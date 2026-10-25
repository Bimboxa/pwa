import { useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setHiddenAnnotationTemplateIds,
  setHiddenRevolutionAxisIds,
} from "Features/scopeVisibility/scopeVisibilitySlice";
import {
  setSoloAnnotationTemplateId,
  setSoloRevolutionAxisId,
} from "Features/annotations/annotationsSlice";
import { resetBaseMapsGridSheetFilters } from "Features/baseMapsGrid/baseMapsGridSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  selectHiddenAnnotationTemplateIds,
  selectHiddenRevolutionAxisIds,
} from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

import db from "App/db/db";
import { isTemplatelessTemplateKey } from "Features/annotations/utils/templatelessAnnotations";
import { ORPHAN_TEMPLATE_ID } from "Features/annotations/utils/orphanAnnotations";

// Sentinel ids of the « Dessin » rows (global and per business-objects
// listing) and of the orphan rows.
const isSentinelTemplateId = (id) =>
  isTemplatelessTemplateKey(id) || id === ORPHAN_TEMPLATE_ID;

// « Supprimer les filtres » of the SCOPE module « Contenu » tab: the display
// filters set on the two other tabs of the popper —
// - « Annotations »: template eyes (sentinel rows « Dessin » / orphans
//   included), revolution axis eyes, template / axis SOLO;
// - « Fonds de plan »: per-sheet image / annotations toggles of the grid and
//   the selected sheet.
// The listing picked on « Contenu » is not one of them (it has its own
// « Filtre : » band). The template / axis eyes are shared with the Dessin
// module (same per-scope state): clearing them shows everything there too.
// `hasFilters` ignores stale ids (a deleted template, a sheet no longer on
// the table) so the button never shows for nothing visible.
export default function useScopeContentFilters() {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const hiddenTemplateIds = useSelector(selectHiddenAnnotationTemplateIds);
  const hiddenAxisIds = useSelector(selectHiddenRevolutionAxisIds);
  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const soloAxisId = useSelector((s) => s.annotations.soloRevolutionAxisId);
  const sheetIds = useSelector((s) => s.baseMapsGrid.scopeSheets.baseMapIds);
  const hiddenImageIds = useSelector(
    (s) => s.baseMapsGrid.hiddenImageBaseMapIds
  );
  const hiddenAnnotationsIds = useSelector(
    (s) => s.baseMapsGrid.hiddenAnnotationsBaseMapIds
  );

  const hiddenTemplateIdsKey = hiddenTemplateIds.join(",");
  const hasLiveHiddenTemplate = useLiveQuery(async () => {
    const ids = hiddenTemplateIdsKey ? hiddenTemplateIdsKey.split(",") : [];
    if (ids.some(isSentinelTemplateId)) return true;
    if (!ids.length) return false;
    const rows = await db.annotationTemplates.bulkGet(ids);
    return rows.some((row) => row && !row.deletedAt);
  }, [hiddenTemplateIdsKey]);

  // helpers

  const hasHiddenSheet = useMemo(() => {
    const sheetIdSet = new Set(sheetIds);
    return [...hiddenImageIds, ...hiddenAnnotationsIds].some((id) =>
      sheetIdSet.has(id)
    );
  }, [sheetIds, hiddenImageIds, hiddenAnnotationsIds]);

  const hasFilters =
    Boolean(hasLiveHiddenTemplate) ||
    hiddenAxisIds.length > 0 ||
    Boolean(soloTemplateId) ||
    Boolean(soloAxisId) ||
    hasHiddenSheet;

  // handlers

  function clearFilters() {
    const state = store.getState();
    const selectedSheetId = state.baseMapsGrid.selectedBaseMapId;
    const selectedItem = state.selection.selectedItems?.[0];

    dispatch(setHiddenAnnotationTemplateIds([]));
    dispatch(setHiddenRevolutionAxisIds([]));
    dispatch(setSoloAnnotationTemplateId(null));
    dispatch(setSoloRevolutionAxisId(null));
    dispatch(resetBaseMapsGridSheetFilters());
    // the properties panel follows the deselected sheet
    if (
      selectedSheetId &&
      selectedItem?.type === "BASE_MAP" &&
      selectedItem.id === selectedSheetId
    )
      dispatch(setSelectedItem(null));
  }

  return { hasFilters, clearFilters };
}
