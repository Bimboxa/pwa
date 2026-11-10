import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import deleteMeshPaintsService from "Features/meshPaint/services/deleteMeshPaintsService";

import getProcedureOutputs from "../services/getProcedureOutputs";
import getProcedurePaintOutputs, {
  procedureWritesPaints,
} from "../services/getProcedurePaintOutputs";

/**
 * Sweeps everything a procedure created from a set of source annotations:
 * its annotations (chained procedures included — getProcedureOutputs) and,
 * for a procedure that paints (registry `outputKind: "MESH_PAINTS"`), its
 * painted parts. Both are read fresh from Dexie at call time, so a relaunch
 * chained right after never stacks a second result on the first.
 *
 * Returns async ({ procedureKey, sourceAnnotationIds }) =>
 *   { annotations: number, paints: number } — what was deleted.
 */
export default function useDeleteProcedureOutputs() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const deleteAnnotations = useDeleteAnnotations();

  return async ({ procedureKey, sourceAnnotationIds }) => {
    const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
    const procedure = procedures.find((p) => p.key === procedureKey);
    const sourceIds = (sourceAnnotationIds ?? []).filter(Boolean);
    if (!procedure || sourceIds.length === 0) {
      return { annotations: 0, paints: 0 };
    }

    // paints first: the ones hosted by an output annotation would go with
    // it (host delete cascade) and must be counted once
    const paints = procedureWritesPaints(procedure)
      ? await getProcedurePaintOutputs({
          projectId,
          procedureKey,
          sourceAnnotationIds: sourceIds,
        })
      : [];
    if (paints.length > 0) {
      await deleteMeshPaintsService({ ids: paints.map((row) => row.id) });
    }

    const annotations = await getProcedureOutputs({
      projectId,
      procedureKey,
      sourceAnnotationIds: sourceIds,
      chainedProcedureKeys: procedure.chainedProcedureKeys,
      procedures,
    });
    if (annotations.length > 0) {
      await deleteAnnotations(annotations.map((a) => a.id));
    }

    return { annotations: annotations.length, paints: paints.length };
  };
}
