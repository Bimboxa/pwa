import { useMemo } from "react";
import { useSelector } from "react-redux";

import usePhasingListing from "./usePhasingListing";
import usePhases from "./usePhases";
import useRelsPhaseAnnotation from "./useRelsPhaseAnnotation";

import getPhaseNewAnnotationIds from "../utils/getPhaseNewAnnotationIds";

// Set of the annotationIds that are NEW in the displayed phases, while the
// "highlight the new annotations" toggle of the phases strip is on: the 2D
// editor and the 3D scene give the others a lighter tint
// (dimPhaseOldAnnotations). null = nothing to dim (toggle off, no displayed
// phase, or the first phase is displayed) — nothing is queried while off.
export default function usePhaseNewAnnotationIdSet() {
  const selectedPhaseIds = useSelector((s) => s.phasing.selectedPhaseIds);
  const highlight = useSelector((s) => s.phasing.highlightNewAnnotations);
  const active = highlight && selectedPhaseIds.length > 0;

  const { listing } = usePhasingListing();
  const listingId = active ? (listing?.id ?? null) : null;
  const phases = usePhases(listingId);
  const { value: rels } = useRelsPhaseAnnotation({ listingId });

  return useMemo(() => {
    if (!active || !phases.length) return null;
    const ids = getPhaseNewAnnotationIds(rels, phases, selectedPhaseIds);
    return ids ? new Set(ids) : null;
  }, [active, selectedPhaseIds, phases, rels]);
}
