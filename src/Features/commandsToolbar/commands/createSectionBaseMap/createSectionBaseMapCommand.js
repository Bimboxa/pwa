import IconCreateBaseMap from "Features/icons/IconCreateBaseMap";
import { stopSectionBaseMapPlacement } from "Features/baseMapLinks/sectionBaseMapPlacementSlice";
import { isBaseMapLinkSource } from "Features/baseMapLinks/utils/baseMapLinkPredicates";
import startSectionBaseMapPlacementTool, {
  SECTION_BASE_MAP_MODULE_KEYS,
} from "Features/baseMapLinks/utils/startSectionBaseMapPlacementTool";

import { EDITOR_2D, EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

const SECTION_LINE_ONLY_REASON = "Sélectionnez un trait de coupe";

// « + fond de plan » (Fonds de plan and Dessin modules —
// Features/baseMapLinks): on the selected section mark (BASE_MAP_LINK
// source, on its plan), previews a VERTICAL page in the 3D editor — a new
// blank page or an existing vertical base map, chosen in the drawing helper —
// inside a fluo green frame. The page is slid by drag and drop in the
// vertical plane of the mark; Space creates / poses it and selects it.
// Launched from the 2D editor, the module switches to its 3D editor. A second
// click on the armed button cancels.
export default {
  key: "CREATE_SECTION_BASE_MAP",
  label: "+ fond de plan (coupe)",
  Icon: IconCreateBaseMap,
  editors: [EDITOR_2D, EDITOR_3D],
  getState(ctx) {
    if (!SECTION_BASE_MAP_MODULE_KEYS.includes(ctx.viewerKey)) {
      return {
        enabled: false,
        reason: "Réservé aux modules Fonds de plan et Dessin",
      };
    }
    if (ctx.sectionBaseMapPlacementActive) {
      return { enabled: true, active: true };
    }
    if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    const state = getSingleAnnotationState(
      ctx,
      ["BASE_MAP_LINK"],
      SECTION_LINE_ONLY_REASON
    );
    if (!state.enabled) {
      // No selection at all: name the expected target, not "an annotation".
      return ctx.selectedAnnotations.length === 0
        ? { enabled: false, reason: SECTION_LINE_ONLY_REASON }
        : state;
    }
    if (!isBaseMapLinkSource(ctx.selectedAnnotation)) {
      return {
        enabled: false,
        reason: "Sélectionnez le trait de coupe sur son plan",
      };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch, store }) {
    if (ctx.sectionBaseMapPlacementActive) {
      dispatch(stopSectionBaseMapPlacement());
      return;
    }
    startSectionBaseMapPlacementTool({
      dispatch,
      getState: store.getState,
      annotation: ctx.selectedAnnotation,
    });
  },
};
