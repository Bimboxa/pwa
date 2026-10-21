import { useMemo } from "react";

import useAnnotationsV2 from "./useAnnotationsV2";

// Counts of annotations per baseMapId for the current project, with the same
// non-visibility filters PopperMapListings applies in the 3D viewer (scope,
// profile templates, hidden templates, base-map annotations, bg-image text)
// — except the hidden listings: a listing hidden from the popper (its count
// pill off) still counts, the badge is the number of annotations ON the base
// map whatever the listings filter. Deliberately omits
// filterByMainBaseMap/extraBaseMapIds so useAnnotationsV2 falls through to
// its "all project annotations" fetch path (see useAnnotationsV2.js ~L693) —
// every baseMap is counted, not just the ones currently visible in 3D. Used
// by the base maps list / top bar badges.
export default function useAnnotationsCountByBaseMapId() {
  const annotations = useAnnotationsV2({
    caller: "useAnnotationsCountByBaseMapId",
    filterBySelectedScope: true,
    excludeProfileTemplates: true,
    hideBaseMapAnnotations: true,
    ignoreSolo: true,
  });

  return useMemo(() => {
    const counts = {};
    (annotations || []).forEach((a) => {
      if (a.baseMapId) counts[a.baseMapId] = (counts[a.baseMapId] ?? 0) + 1;
    });
    return counts;
  }, [annotations]);
}
