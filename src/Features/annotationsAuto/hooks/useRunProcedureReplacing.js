import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useAnnotationsAutoRun from "./useAnnotationsAutoRun";
import getProcedureOutputs from "../services/getProcedureOutputs";
import notifyProcedureRunResult from "../utils/notifyProcedureRunResult";

/**
 * Runs an ANNOTATIONS_CREATOR procedure from explicit sources, REPLACING its
 * previous outputs: the rows tagged with those sources (chained procedures
 * included — getProcedureOutputs) are deleted BEFORE the new run commits, so
 * a launch never stacks a second drawing on the first. Shared by the listing
 * « Dessin auto » band, the revolution-axis launch dialog, the axis toolbar
 * and the auto-launch outlet.
 *
 * Returns the run result (null when the run could not start). The selection
 * is cleared afterwards: the source (an axis, a wall) was the selected item
 * while the launcher was open and must not stay highlighted — with its edit
 * toolbar — over the freshly drawn outputs.
 */
export default function useRunProcedureReplacing() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const run = useAnnotationsAutoRun();
  const deleteAnnotations = useDeleteAnnotations();

  return async ({ procedureKey, sourceAnnotationIds, procedureParams }) => {
    const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
    const entry = procedures.find((p) => p.key === procedureKey);
    const sourceIds = (sourceAnnotationIds ?? []).filter(Boolean);
    if (!entry || sourceIds.length === 0) return null;

    const previousOutputs = await getProcedureOutputs({
      projectId,
      procedureKey,
      sourceAnnotationIds: sourceIds,
      chainedProcedureKeys: entry.chainedProcedureKeys,
      procedures,
    });
    if (previousOutputs.length > 0) {
      await deleteAnnotations(previousOutputs.map((a) => a.id));
    }

    const result = await run({
      procedureKey,
      sourceAnnotationIds: sourceIds,
      // fallback source tag for annotations the procedure leaves untagged;
      // reset / refresh match by source-id set membership
      autoCreatedFrom: sourceIds[0],
      procedureParams: procedureParams ?? null,
    });
    notifyProcedureRunResult(dispatch, result);
    dispatch(clearSelection());
    return result;
  };
}
