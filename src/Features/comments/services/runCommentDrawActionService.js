import db from "App/db/db";

import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";
import { THREED_TOGGLED_DRAWABLE_SHAPES } from "Features/mapEditor/hooks/useDrawFromTemplate";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import getLinkBusinessObjectDraftProps from "Features/businessObjects/utils/getLinkBusinessObjectDraftProps";
import ensureCommentDrawModule from "../utils/ensureCommentDrawModule";

// Click on a DRAW_ACTION block of an info: starts the drawing of its
// annotation template with its tool, like a click on the template row of
// PopperMapListings. The reader is first sent to a module that draws (the
// info stays opened there: LayerComments is mounted in every module), in its 2D editor when the
// template's shape cannot be drawn in 3D.
// Returns { ok: true } or { ok: false, reason } (user-facing).
export default async function runCommentDrawActionService({
  block,
  sourceModuleKey = null,
  dispatch,
  store,
}) {
  const template = block?.annotationTemplateId
    ? await db.annotationTemplates.get(block.annotationTemplateId)
    : null;
  if (!template || template.deletedAt) {
    return { ok: false, reason: "Modèle d'annotation introuvable" };
  }

  // 1. module + editor (2D when the template's shape cannot be drawn in 3D).
  // The MODULE switch stops any drawing in progress, so it comes before the
  // draft.
  const moduleKey = ensureCommentDrawModule({
    store,
    dispatch,
    sourceModuleKey,
    needs2dEditor: !THREED_TOGGLED_DRAWABLE_SHAPES.includes(
      resolveDrawingShape(template)
    ),
  });

  // 2. tool: the block's one, else the template's (defaultTool, first tool)
  const state = store.getState();
  const activeTool = resolveActiveToolForTemplate(template, block.toolKey, {
    editor: selectDrawingToolsEditor(state),
  });
  if (!activeTool) {
    return { ok: false, reason: "Aucun outil de dessin pour ce modèle" };
  }

  // 3. draft + drawing mode. In a business-objects module, the annotation is
  // linked to the active object (same rule as the template rows).
  const activeBusinessObjectId = isBusinessObjectsModuleKey(moduleKey)
    ? (state.businessObjects?.activeBusinessObjectId ?? null)
    : null;
  startDrawFromTemplate(dispatch, {
    template,
    listingId: template.listingId,
    activeTool,
    rememberedProps: state.mapEditor.draftPropsByTemplateId?.[template.id],
    extraProps: getLinkBusinessObjectDraftProps(activeBusinessObjectId),
  });
  return { ok: true };
}
