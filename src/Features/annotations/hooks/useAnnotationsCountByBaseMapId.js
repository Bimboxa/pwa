import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "./useAnnotationsV2";

// Counts of annotations per baseMapId for the current project, with the same
// non-visibility filters PopperMapListings applies in the 3D viewer (scope,
// hidden listings, profile templates, hidden templates, base-map annotations,
// bg-image text). Deliberately omits filterByMainBaseMap/extraBaseMapIds so
// useAnnotationsV2 falls through to its "all project annotations" fetch path
// (see useAnnotationsV2.js ~L693) — every baseMap is counted, not just the
// ones currently visible in 3D. Used by the 3D top base-map chips badges.
export default function useAnnotationsCountByBaseMapId() {
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const annotations = useAnnotationsV2({
    caller: "useAnnotationsCountByBaseMapId",
    filterBySelectedScope: true,
    excludeListingsIds: hiddenListingsIds,
    excludeProfileTemplates: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
    excludeBgAnnotations: true,
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
