import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import startTemplatelessDraw from "Features/mapEditor/utils/startTemplatelessDraw";
import IconCutLineSegment from "Features/threedCutLines/components/IconCutLineSegment";

import { EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Segment de coupe » (K, 3D, Maillage module — Features/threedCutLines):
// the two-click variant of « Ligne de coupe » (DRAW_CUT_LINE), as a segment
// is to a polyline. Arms a CUT_LINE draft flagged `cutSegment`: the second
// click commits the line (commitDrawnCutLineService), and « Arrêter à la
// première arête / ligne » is on by default for it
// (`cutLineDraw.segmentStopAtFirst`). A second click on the armed button
// disarms it.
const CUT_LINE_SHAPE = "CUT_LINE";

export default {
  key: "DRAW_CUT_SEGMENT",
  usesSelection: false,
  label: "Segment de coupe",
  Icon: IconCutLineSegment,
  editors: [EDITOR_3D],
  hotkey: { key: "k", editors: [EDITOR_3D] },
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
        ctx.isCutSegmentDraft;
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
      dispatch(setNewAnnotation({ ...draft, cutSegment: true }));
    }
  },
};
