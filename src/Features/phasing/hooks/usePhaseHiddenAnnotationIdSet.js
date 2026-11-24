import { useMemo } from "react";
import { useSelector } from "react-redux";

import usePhasingListing from "./usePhasingListing";
import usePhases from "./usePhases";
import useRelsPhaseAnnotation from "./useRelsPhaseAnnotation";

import groupPhaseRelsByAnnotationId from "../utils/groupPhaseRelsByAnnotationId";
import resolveAnnotationPhaseIndexes from "../utils/resolveAnnotationPhaseIndexes";

const EMPTY_SET = new Set();

// Set of the annotationIds present in NONE of the selected phases: the 2D
// editor and the 3D scene drop them (filterPhaseHiddenAnnotations). Display
// only — quantities, listings and exports never read it. An annotation
// without any phase row is present in every phase, so it is never in the
// set. Stable empty Set while no phase is selected (nothing is queried).
export default function usePhaseHiddenAnnotationIdSet() {
  const selectedPhaseIds = useSelector((s) => s.phasing.selectedPhaseIds);
  const hasSelection = selectedPhaseIds.length > 0;

  const { listing } = usePhasingListing();
  const listingId = hasSelection ? (listing?.id ?? null) : null;
  const phases = usePhases(listingId);
  const { value: rels } = useRelsPhaseAnnotation({ listingId });

  return useMemo(() => {
    if (!hasSelection || !phases.length || !rels.length) return EMPTY_SET;
    const selectedIndexes = phases
      .map((phase, index) => (selectedPhaseIds.includes(phase.id) ? index : -1))
      .filter((index) => index >= 0);
    // stale selection (phases of another listing): nothing to filter
    if (selectedIndexes.length === 0) return EMPTY_SET;

    const hidden = new Set();
    groupPhaseRelsByAnnotationId(rels).forEach((annotationRels, id) => {
      const indexes = resolveAnnotationPhaseIndexes(annotationRels, phases);
      if (!selectedIndexes.some((index) => indexes.has(index))) hidden.add(id);
    });
    return hidden.size > 0 ? hidden : EMPTY_SET;
  }, [hasSelection, selectedPhaseIds, phases, rels]);
}
