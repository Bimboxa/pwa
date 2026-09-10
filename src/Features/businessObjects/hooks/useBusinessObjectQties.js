import { useMemo } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useRelsBusinessObjectAnnotation from "./useRelsBusinessObjectAnnotation";

import computeBusinessObjectQties from "../utils/computeBusinessObjectQties";

// Rolled-up quantities of every business object of a listing, from its linked
// annotations, over the whole scope. The rollup rule itself lives in
// computeBusinessObjectQties (shared with the SCOPE module recap, which feeds
// it one base map's annotations at a time).
// Returns {qtiesByObjectId: {count, length, surface}, annotationsByObjectId,
// mainRelsByObjectId, mainAnnotationsByObjectId} — the last two hold the
// object's MAIN annotations (rels flagged isMain, one per base map).
export default function useBusinessObjectQties({ listingId } = {}) {
  // data

  const { value: rels } = useRelsBusinessObjectAnnotation({ listingId });

  const annotations = useAnnotationsV2({
    caller: "useBusinessObjectQties",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
  });

  // main

  return useMemo(
    () => computeBusinessObjectQties({ rels, annotations }),
    [rels, annotations]
  );
}
