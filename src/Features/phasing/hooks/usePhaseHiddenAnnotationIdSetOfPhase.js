import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import getPhaseHiddenAnnotationIdsService from "../services/getPhaseHiddenAnnotationIdsService";

const EMPTY_SET = new Set();

// Set of the annotationIds NOT present in the given phase — for a view
// pinned on one phase, whatever the phases selected in the strip (portfolio
// container of a « Journal des phases », container.phaseId). Stable empty Set
// without a phase (nothing is queried).
export default function usePhaseHiddenAnnotationIdSetOfPhase(phaseId) {
  const relsUpdatedAt = useSelector((s) => s.phasing.relsPhaseUpdatedAt);
  const phasesUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );

  const ids = useLiveQuery(
    () => (phaseId ? getPhaseHiddenAnnotationIdsService(phaseId) : null),
    [phaseId, relsUpdatedAt, phasesUpdatedAt]
  );

  return useMemo(() => {
    if (!ids?.length) return EMPTY_SET;
    return new Set(ids);
  }, [ids]);
}
