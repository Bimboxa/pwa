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
 * `includeKept` (the explicit « Supprimer » of a launcher, never a
 * relaunch): also deletes what the procedure deliberately KEEPS across its
 * relaunches — annotations it untagged because the user edits them (e.g. the
 * gutter profiles of a pool). The registry entry lists them with
 * `keptOutputs: () => import(...)`, a module whose default export is
 * async ({ projectId, sourceAnnotationIds }) => annotation ids.
 *
 * Returns async ({ procedureKey, sourceAnnotationIds, includeKept }) =>
 *   { annotations: number, paints: number } — what was deleted.
 */
export default function useDeleteProcedureOutputs() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const deleteAnnotations = useDeleteAnnotations();

  return async ({ procedureKey, sourceAnnotationIds, includeKept = false }) => {
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
    const ids = new Set(annotations.map((a) => a.id));
    if (includeKept && typeof procedure.keptOutputs === "function") {
      try {
        const getKeptOutputs = (await procedure.keptOutputs()).default;
        const keptIds = await getKeptOutputs({
          projectId,
          sourceAnnotationIds: sourceIds,
        });
        (keptIds ?? []).filter(Boolean).forEach((id) => ids.add(id));
      } catch (e) {
        console.error("[useDeleteProcedureOutputs] keptOutputs failed", e);
      }
    }
    if (ids.size > 0) await deleteAnnotations([...ids]);

    return { annotations: ids.size, paints: paints.length };
  };
}
