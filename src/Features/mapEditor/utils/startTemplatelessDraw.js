import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  setEnabledDrawingMode,
  setTemplatelessDrawingShape,
} from "Features/mapEditor/mapEditorSlice";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getImagePickDraftProps from "Features/imageAnnotations/utils/getImagePickDraftProps";
import {
  getDrawingToolsByShape,
  getDrawingToolByKey,
} from "Features/mapEditor/constants/drawingTools.jsx";
import {
  DEFAULT_TEMPLATELESS_DRAWING_SHAPE,
  getTemplatelessDraftKey,
} from "Features/annotations/utils/templatelessAnnotations";

// Annotation types the "Dessin" tool offers in the 3D editor (mesh drawing).
export const MESH3D_DRAWING_SHAPES = ["POLYGON", "POLYLINE"];

// Active drawing tool of a templateless shape: last used one → first tool of
// the shape group.
export function resolveActiveToolForShape(drawingShape, selectedToolKey) {
  const tools = getDrawingToolsByShape(drawingShape);
  const selectedTool = selectedToolKey
    ? getDrawingToolByKey(selectedToolKey)
    : null;
  return tools.find((t) => t.key === selectedTool?.key) ?? tools[0] ?? null;
}

export function getTemplatelessDraft(drawingShape, rememberedProps) {
  const draft = getNewAnnotationPropsFromAnnotationTemplate(
    { drawingShape },
    rememberedProps
  );
  delete draft.annotationTemplateId;
  delete draft.listingId;
  Object.assign(draft, getImagePickDraftProps(drawingShape, draft));
  draft.isTemplateless = true;
  return draft;
}

// "Dessin" tool (hotkey D): start a draw WITHOUT annotation template nor
// listing. Twin of startDrawFromTemplate, reading the mapEditor state.
//
// options.mesh3d: the tool is started from the 3D editor — lines are drawn on
// the faces of the annotation meshes (draft tagged `isMesh3d`). Only the line
// and surface types make sense there (MESH3D_DRAWING_SHAPES): another
// remembered type falls back to POLYGON without being overwritten.
export default function startTemplatelessDraw(
  dispatch,
  state,
  drawingShape,
  options = {}
) {
  const requested =
    drawingShape ??
    state.mapEditor.templatelessDrawingShape ??
    DEFAULT_TEMPLATELESS_DRAWING_SHAPE;
  const shape =
    options.mesh3d && !MESH3D_DRAWING_SHAPES.includes(requested)
      ? "POLYGON"
      : requested;
  const key = getTemplatelessDraftKey(shape);
  const activeTool = resolveActiveToolForShape(
    shape,
    state.mapEditor.selectedToolKeyByTemplateId?.[key]
  );
  if (!activeTool) return;

  const draft = getTemplatelessDraft(
    shape,
    state.mapEditor.draftPropsByTemplateId?.[key]
  );

  if (options.mesh3d) draft.isMesh3d = true;
  if (shape === requested) dispatch(setTemplatelessDrawingShape(shape));
  dispatch(
    setNewAnnotation(
      activeTool.annotationType
        ? { ...draft, type: activeTool.annotationType }
        : draft
    )
  );
  dispatch(setEnabledDrawingMode(activeTool.drawingMode ?? activeTool.key));
}
