import IconSectionLine from "Features/icons/IconSectionLine";
import {
  isBaseMapLinkDraft,
  startDrawBaseMapLink,
  stopBaseMapLinkTools,
} from "Features/baseMapLinks/utils/startBaseMapLinkTools";

import { EDITOR_2D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Dessiner un trait de coupe » (Fonds de plan module, 2D —
// Features/baseMapLinks): arms the two-click draw of a section mark
// (BASE_MAP_LINK) on the current HORIZONTAL plan. The mark is a template-less
// helper of the scope, like a revolution axis; it is then located on a
// vertical base map from the « Traits de coupe » section of the listings
// popper, which poses that base map in 3D. A second click on the armed button
// disarms it.
//
// Not gated by getDrawToolsGate: the Fonds de plan module forces the SELECT
// interaction mode for its listings popper (legend), which that gate reads.
export default {
  key: "DRAW_SECTION_LINE",
  label: "Dessiner un trait de coupe",
  Icon: IconSectionLine,
  editors: [EDITOR_2D],
  getState(ctx) {
    if (ctx.viewerKey !== "BASE_MAPS") {
      return { enabled: false, reason: "Réservé au module Fonds de plan" };
    }
    if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (!ctx.baseMap) {
      return { enabled: false, reason: "Sélectionnez un fond de plan" };
    }
    if (ctx.enabledDrawingMode) {
      const active =
        isBaseMapLinkDraft({ type: ctx.newAnnotationType }) &&
        !ctx.isVerticalBaseMap;
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    if (ctx.isVerticalBaseMap) {
      return {
        enabled: false,
        reason:
          "Réservé aux plans horizontaux — sur une coupe / élévation, repérez un trait depuis la liste « Traits de coupe »",
      };
    }
    if (ctx.baseMap.isPhoto) {
      return { enabled: false, reason: "Indisponible sur une photo" };
    }
    if (!ctx.hasScale) {
      return {
        enabled: false,
        reason: "Mettez d'abord le fond de plan à l'échelle",
      };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch }) {
    if (ctx.enabledDrawingMode) {
      stopBaseMapLinkTools(dispatch);
      return;
    }
    startDrawBaseMapLink(dispatch);
  },
};
