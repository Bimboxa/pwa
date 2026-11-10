import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getProcedurePaintOutputs, {
  procedureWritesPaints,
} from "../services/getProcedurePaintOutputs";

const EMPTY = [];

/**
 * Live painted parts written by a procedure from the given sources
 * (getProcedurePaintOutputs), for display: counts, play vs refresh icons,
 * delete buttons. Empty for a procedure that writes no paint (registry
 * `outputKind`). A delete / relaunch re-reads them from Dexie at call time.
 */
export default function useProcedurePaintOutputs({
  procedureKey,
  sourceAnnotationIds,
}) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const procedure = (appConfig?.automatedAnnotationsProcedures ?? []).find(
    (p) => p.key === procedureKey
  );
  const writesPaints = procedureWritesPaints(procedure);
  const sourceIds = (sourceAnnotationIds ?? []).filter(Boolean);
  const sourceKey = sourceIds.join(",");

  // db.meshPaints is read inside the liveQuery: a run / a delete re-emits
  const outputs = useLiveQuery(
    () =>
      writesPaints && sourceIds.length > 0
        ? getProcedurePaintOutputs({
            projectId,
            procedureKey,
            sourceAnnotationIds: sourceIds,
          })
        : EMPTY,
    [projectId, procedureKey, writesPaints, sourceKey]
  );

  return outputs ?? EMPTY;
}
