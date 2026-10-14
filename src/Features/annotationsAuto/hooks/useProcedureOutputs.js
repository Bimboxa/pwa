import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getProcedureOutputs from "../services/getProcedureOutputs";

const EMPTY = [];

/**
 * Live outputs of a procedure run from the given sources (chained outputs
 * included — getProcedureOutputs), for display: counts, play vs refresh
 * icons, delete buttons. A delete / relaunch must re-read the outputs from
 * Dexie at call time (getProcedureOutputs), never use this React state.
 */
export default function useProcedureOutputs({
  procedureKey,
  sourceAnnotationIds,
}) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const procedure = procedures.find((p) => p.key === procedureKey);
  const sourceIds = (sourceAnnotationIds ?? []).filter(Boolean);
  const sourceKey = sourceIds.join(",");

  const outputs = useLiveQuery(
    () =>
      procedure && sourceIds.length > 0
        ? getProcedureOutputs({
            projectId,
            procedureKey,
            sourceAnnotationIds: sourceIds,
            chainedProcedureKeys: procedure.chainedProcedureKeys,
            procedures,
          })
        : EMPTY,
    [projectId, procedureKey, sourceKey, annotationsUpdatedAt]
  );

  return outputs ?? EMPTY;
}
