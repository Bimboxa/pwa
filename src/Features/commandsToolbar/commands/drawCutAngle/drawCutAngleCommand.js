import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import startTemplatelessDraw from "Features/mapEditor/utils/startTemplatelessDraw";
import IconCutAngle from "Features/threedCutLines/components/IconCutAngle";
import {
  clearCutPlanePending,
  setCutAngleRef,
} from "Features/threedCutLines/services/cutPlaneStore";
import { CUT_PLANE_KIND_ANGLE } from "Features/threedDrawing/utils/templateFaceDrawSelectors";

import { EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Coupe par angle » (3D, Maillage module — Features/threedCutLines): arms
// a CUT_LINE draft flagged `cutPlane` of kind "ANGLE". Three clicks: the
// pivot of the rotation axis (user Z by default, X / Y / Z keys), the
// reference direction (0°), then the angle (typed angle, `*N` half-planes
// repeated every angle, `/N` half-planes dividing it). The third click
// shows the candidate cut lines — the section of the visible annotations by
// every half-plane starting on the axis — and Space / Enter creates them.
// A second click on the armed button disarms it.
const CUT_LINE_SHAPE = "CUT_LINE";

export default {
  key: "DRAW_CUT_ANGLE",
  label: "Coupe par angle",
  Icon: IconCutAngle,
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
        ctx.isCutAngleDraft;
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
    setCutAngleRef(null);
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
      dispatch(
        setNewAnnotation({
          ...draft,
          cutPlane: true,
          cutPlaneKind: CUT_PLANE_KIND_ANGLE,
        })
      );
    }
  },
};
