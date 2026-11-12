import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import startTemplatelessDraw from "Features/mapEditor/utils/startTemplatelessDraw";
import IconCutPlane from "Features/threedCutLines/components/IconCutPlane";
import { clearCutPlanePending } from "Features/threedCutLines/services/cutPlaneStore";

import { EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Plan de coupe » (3D, Maillage module — Features/threedCutLines): arms a
// CUT_LINE draft flagged `cutPlane`. Two clicks draw the axis P1 → P2 the
// cut planes are normal to (typed length, `*N` planes repeated beyond P2,
// `/N` planes dividing P1 → P2); the second click shows the candidate cut
// lines — the section of the visible annotations by every plane — and
// Space / Enter creates them. A second click on the armed button disarms it.
const CUT_LINE_SHAPE = "CUT_LINE";

export default {
  key: "DRAW_CUT_PLANE",
  label: "Plan de coupe",
  Icon: IconCutPlane,
  editors: [EDITOR_3D],
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
        ctx.isCutPlaneDraft;
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
    clearCutPlanePending();
    if (ctx.enabledDrawingMode) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      return;
    }
    startTemplatelessDraw(dispatch, store.getState(), CUT_LINE_SHAPE, {
      threed: true,
      remember: false,
    });
    const draft = store.getState().annotations.newAnnotation;
    if (draft?.type === CUT_LINE_SHAPE) {
      dispatch(setNewAnnotation({ ...draft, cutPlane: true }));
    }
  },
};
