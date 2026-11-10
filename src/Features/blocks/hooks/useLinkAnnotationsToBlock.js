import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { clearSelection } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import linkAnnotationsToBlockService from "../services/linkAnnotationsToBlockService";

// « Lier à un bloc » from a regular base map (see the service): moves the
// annotations into the block and leaves an instance in place.
// Returns async ({annotations, blockId?, newBlockLabel?}) => result.
export default function useLinkAnnotationsToBlock() {
  const dispatch = useDispatch();

  // strings

  const linkedS = "Annotations liées au bloc : une instance les remplace.";
  const linkedToInstanceS =
    "Annotations ajoutées au bloc : toutes ses instances sont à jour.";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  // main

  return async function linkAnnotationsToBlock({
    annotations,
    blockId,
    newBlockLabel,
  }) {
    let result;
    try {
      result = await linkAnnotationsToBlockService({
        annotations,
        blockId,
        newBlockLabel,
        projectId,
        scopeId,
        activeLayerId: activeLayerId ?? null,
      });
    } catch (error) {
      console.error("[linkAnnotationsToBlock] failed", error);
      result = { error: "La liaison au bloc a échoué.", movedIds: [] };
    }

    if (result.createdBlocksBaseMap)
      dispatch(triggerEntitiesTableUpdate("baseMaps"));

    if (result.error) {
      dispatch(setToaster({ message: result.error, severity: "warning" }));
      return result;
    }

    // the annotations left this base map
    dispatch(clearSelection());
    dispatch(triggerAnnotationsUpdate());
    dispatch(
      setToaster({
        message: result.usedReferenceInstance ? linkedToInstanceS : linkedS,
        severity: "success",
      })
    );
    return result;
  };
}
