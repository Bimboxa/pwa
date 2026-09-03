import { useDispatch, useSelector } from "react-redux";

import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";
import { setToaster } from "Features/layout/layoutSlice";

import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";

import findObjectTemplateInListing from "../services/findObjectTemplateInListing";

// Deterministic library-model id for a système template, so re-running "Dessiner"
// into the same listing reuses the existing rows instead of duplicating them
// (dedup is by modelIdMaster via findObjectTemplateInListing, like the 2D flow).
function getSystemTemplateModelId(object, template) {
  const base = object?.modelIdMaster ?? object?.id ?? "system";
  const slot =
    template?.mappingCategories?.[0] ?? template?.label ?? "TEMPLATE";
  return `${base}:${slot}`;
}

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
  const createTemplatesFromLibrary = useCreateAnnotationTemplatesFromLibrary();
  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ object, mainTemplate, generatedTemplates, listingId }) => {
    if (!object || !listingId || !mainTemplate) return;

    const projectId = selectedProjectId;

    // Tag each template (source + generated) with a deterministic modelIdMaster.
    const sourceTemplate = {
      ...mainTemplate,
      modelIdMaster: getSystemTemplateModelId(object, mainTemplate),
    };
    const otherTemplates = (generatedTemplates ?? []).map((t) => ({
      ...t,
      modelIdMaster: getSystemTemplateModelId(object, t),
    }));
    const allTemplates = [sourceTemplate, ...otherTemplates];

    // Only create the templates that aren't already in the listing.
    const toCreate = [];
    for (const template of allTemplates) {
      const existing = await findObjectTemplateInListing(
        listingId,
        template.modelIdMaster
      );
      if (!existing) toCreate.push(template);
    }
    if (toCreate.length > 0) {
      // Bulk insert in one transaction + single triggerAnnotationTemplatesUpdate.
      await createTemplatesFromLibrary(toCreate, { listingId, projectId });
    }

    // Fetch the source row (freshly created or pre-existing) so the drawing commit
    // links the drawn annotation to it (and its procedureKeys).
    const sourceRow = await findObjectTemplateInListing(
      listingId,
      sourceTemplate.modelIdMaster
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
