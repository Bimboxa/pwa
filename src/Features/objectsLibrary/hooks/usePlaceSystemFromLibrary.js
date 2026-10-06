import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import { buildRevolutionAxisDraft } from "Features/revolutionAxes/utils/buildRevolutionAxisDrafts";

import findObjectTemplateInListing from "../services/findObjectTemplateInListing";
import useEnsureSystemTemplatesInListing, {
  getSystemTemplateModelId,
} from "./useEnsureSystemTemplatesInListing";

// "Dessiner" for a Système: pre-create the source template AND every generated
// template (with the user's dialog edits) in the target listing so the procedure
// can find them, then arm drawing of the source. The procedure itself is launched
// afterward from the existing "Dessin auto" controls — except procedures flagged
// `launchOnSourceCreated` in the registry (e.g. CHATEAU_EAU_V1), whose params
// dialog auto-opens right after the source is drawn: the source row carries
// procedureKeys, and the generated rows now exist in the listing for
// matchAnnotationTemplate to resolve.
export default function usePlaceSystemFromLibrary() {
  const dispatch = useDispatch();
  const ensureTemplates = useEnsureSystemTemplatesInListing();

  return async ({ object, mainTemplate, generatedTemplates, listingId }) => {
    if (!object || !listingId || !mainTemplate) return;

    // Revolution-axis source (useSystemDefinition stand-in, e.g. Château
    // d'eau): an axis belongs to its base map + scope — no source template.
    // Create the generated templates only, then arm the axis tool; the draft
    // carries the procedure to open once the axis is drawn
    // (useHandleCommitDrawing → ProcedureAutoLaunchDialogOutlet).
    if (mainTemplate.isScopeBoundSource) {
      await ensureTemplates({
        object,
        templates: generatedTemplates,
        listingId,
      });
      const tool = getDrawingToolByKey("REVOLUTION_AXIS_PLAN");
      if (!tool) return;
      dispatch(
        setNewAnnotation({
          ...buildRevolutionAxisDraft(),
          ...(mainTemplate.strokeColor
            ? { strokeColor: mainTemplate.strokeColor }
            : {}),
          ...(object.procedureKey
            ? { launchProcedureKeyOnCreated: object.procedureKey }
            : {}),
        })
      );
      dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
      return;
    }

    // Source + generated templates, each tagged with a deterministic
    // modelIdMaster; only the ones missing from the listing are created.
    await ensureTemplates({
      object,
      templates: [mainTemplate, ...(generatedTemplates ?? [])],
      listingId,
    });

    // Fetch the source row (freshly created or pre-existing) so the drawing commit
    // links the drawn annotation to it (and its procedureKeys).
    const sourceRow = await findObjectTemplateInListing(
      listingId,
      getSystemTemplateModelId(object, mainTemplate)
    );
    if (!sourceRow) {
      dispatch(
        setToaster({
          message: "Impossible de préparer le template de départ.",
          severity: "error",
        })
      );
      return;
    }

    // Arm drawing of the source template (e.g. SURFACE_DROP for a Sol polygon).
    const activeTool = resolveActiveToolForTemplate(sourceRow, null);
    startDrawFromTemplate(dispatch, {
      template: sourceRow,
      listingId,
      activeTool,
    });
  };
}
