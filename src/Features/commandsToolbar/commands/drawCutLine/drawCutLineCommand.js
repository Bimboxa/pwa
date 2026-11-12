import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import startTemplatelessDraw from "Features/mapEditor/utils/startTemplatelessDraw";
import IconCutLineTrace from "Features/threedCutLines/components/IconCutLineTrace";

import { EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Ligne de coupe » (C, 3D, Maillage module — Features/threedCutLines): arms a
// template-less CUT_LINE draft on the click polyline flow; the commit
// (commitDrawnCutLineService) extends both ends of the drawn line along the
// faces of the annotations it lies on. A second click on the armed button
// disarms it. The draft belongs to the scope (no listing), like the
// « Dessin » annotations. « C » only arms it (command hotkeys are inert
// while a draw is armed — Escape disarms); « Coupe face » shares the letter
// but is disabled in the Maillage module.
const CUT_LINE_SHAPE = "CUT_LINE";

export default {
  key: "DRAW_CUT_LINE",
  label: "Ligne de coupe",
  Icon: IconCutLineTrace,
  editors: [EDITOR_3D],
  hotkey: { key: "c", editors: [EDITOR_3D] },
  getState(ctx) {
    if (ctx.viewerKey !== "MESHES") {
      return { enabled: false, reason: "Réservé au module Maillage" };
    }
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (ctx.enabledDrawingMode) {
      const active =
        ctx.isTemplatelessDraft &&
        ctx.newAnnotationType === CUT_LINE_SHAPE &&
        !ctx.isCutPlaneDraft;
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch, store }) {
    if (ctx.enabledDrawingMode) {
      // Armed: disarm (the bridge then ends the 3D drawing mode, the
      // Maillage module re-arms its meshing tools).
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      return;
    }
    startTemplatelessDraw(dispatch, store.getState(), CUT_LINE_SHAPE, {
      threed: true,
      remember: false,
    });
  },
};
