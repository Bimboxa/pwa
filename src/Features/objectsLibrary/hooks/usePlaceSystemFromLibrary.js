import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";

import ensureListingProcedureKeys from "Features/annotationsAuto/services/ensureListingProcedureKeys";

import findObjectTemplateInListing from "../services/findObjectTemplateInListing";
import useEnsureSystemTemplatesInListing, {
  getSystemTemplateModelId,
} from "./useEnsureSystemTemplatesInListing";

// "Dessiner" for a Système: pre-create the source template AND every generated
// template (with the user's dialog edits) in the target listing so the procedure
// can find them, then arm drawing of the source. The procedure itself is launched
// afterward from the existing "Dessin auto" controls — except procedures flagged
// `launchOnSourceCreated` in the registry, whose params dialog auto-opens right
// after the source is drawn: the source row carries procedureKeys, and the
// generated rows now exist in the listing for matchAnnotationTemplate to
// resolve. Revolution-axis systems are not library systems any more: they are
// launched from their listing's « Dessin auto » band.
export default function usePlaceSystemFromLibrary() {
  const dispatch = useDispatch();
  const ensureTemplates = useEnsureSystemTemplatesInListing();

  return async ({
    object,
    mainTemplate,
    generatedTemplates,
    listingId,
    listingProcedureKeys,
  }) => {
    if (!object || !listingId || !mainTemplate) return;

    // procedures chained to the système's procedure (useSystemDefinition
    // listingProcedureKeys) are launched from the listing's « Dessin auto »
    // band: link them on the target listing.
    await ensureListingProcedureKeys(listingId, listingProcedureKeys);

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
