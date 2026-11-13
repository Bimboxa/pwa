import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  setBaseMapLinkAdaptScale,
  setEnabledDrawingMode,
  setSmartDetectEnabled,
} from "Features/mapEditor/mapEditorSlice";
import { setShowSectionLines } from "Features/popperMapListings/popperMapListingsSlice";

import DRAWING_SHAPE_CONFIG from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";

import { BASE_MAP_LINK_TYPE } from "./baseMapLinkPredicates";

// Drafts and arming of the section marks ("trait de coupe"), Fonds de plan
// module only:
// - DRAW: a new mark on a horizontal plan (command « Dessiner un trait de
//   coupe »);
// - LOCATE: an existing mark on a VERTICAL base map (row of the « Traits de
//   coupe » section of the popper) — the commit creates its clone and poses
//   that base map in 3D.
//
// Both drafts are template-less and listing-less: the row belongs to its
// base map + the scope (see baseMapLinkPredicates).
const TOOL_KEY = "BASE_MAP_LINK_SEGMENT";

const STYLE_KEYS = [
  "strokeColor",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeOpacity",
];

function getDrawingMode() {
  const tool = getDrawingToolByKey(TOOL_KEY);
  return tool ? (tool.drawingMode ?? tool.key) : null;
}

export function buildBaseMapLinkDraft() {
  return {
    type: BASE_MAP_LINK_TYPE,
    ...DRAWING_SHAPE_CONFIG.BASE_MAP_LINK.defaults,
  };
}

// The located mark mirrors its source's style. `label` and `sourceLinkLengthM`
// only feed the drawing ghost / preview: the commit never stores them (a
// clone reads its label from the source, see useAnnotationsV2).
export function buildBaseMapLinkCloneDraft(link, { lengthM } = {}) {
  const draft = buildBaseMapLinkDraft();
  STYLE_KEYS.forEach((key) => {
    if (link?.[key] !== undefined && link?.[key] !== null) {
      draft[key] = link[key];
    }
  });
  return {
    ...draft,
    label: link?.label ?? undefined,
    sourceLinkAnnotationId: link.id,
    sourceLinkLengthM: lengthM ?? null,
  };
}

export function isBaseMapLinkDraft(newAnnotation) {
  return newAnnotation?.type === BASE_MAP_LINK_TYPE;
}

export function isBaseMapLinkLocateDraft(newAnnotation) {
  return (
    isBaseMapLinkDraft(newAnnotation) &&
    Boolean(newAnnotation.sourceLinkAnnotationId)
  );
}

function arm(dispatch, draft) {
  const drawingMode = getDrawingMode();
  if (!drawingMode) return;
  // A mark drawn while the "Traits de coupe" switch is off would vanish at
  // commit: the tool turns the switch back on.
  dispatch(setShowSectionLines(true));
  dispatch(setNewAnnotation(draft));
  dispatch(setEnabledDrawingMode(drawingMode));
  // The segment-snap detection would glue the mark on a wall: never here.
  dispatch(setSmartDetectEnabled(false));
}

/** Arms the drawing of a new section mark on the current (horizontal) plan. */
export function startDrawBaseMapLink(dispatch) {
  arm(dispatch, buildBaseMapLinkDraft());
}

// Arms the locating of an existing section mark on the current (vertical)
// base map. "Adapter l'échelle" starts OFF at each arming.
export function startLocateBaseMapLink(dispatch, link, { lengthM } = {}) {
  if (!link?.id) return;
  dispatch(setBaseMapLinkAdaptScale(false));
  arm(dispatch, buildBaseMapLinkCloneDraft(link, { lengthM }));
}

/** Disarms a section-mark draw / locate. */
export function stopBaseMapLinkTools(dispatch) {
  dispatch(setEnabledDrawingMode(null));
  dispatch(setNewAnnotation({}));
}
