import { useMemo } from "react";
import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import useScopeListing from "./useScopeListing";
import useScopeGridAnnotationsFilter from "./useScopeGridAnnotationsFilter";

const EMPTY_IDS = [];

// Sheets of the pinned base maps grid (SCOPE module, 2D and 3D): which base
// maps lie on the table, driven by the content selection of the scope
// panel — no base maps listing tabs there. Per listing kind:
//   - base map listing (folder) -> the base maps of that folder;
//   - annotation listing / business-objects listing / "Afficher toutes les
//     listes" -> every base map of the project carrying at least one
//     annotation kept by the filter (useScopeGridAnnotationsFilter),
//     whatever its folder.
// Folders hidden by the eye of the scope panel (listings.hiddenListingsIds)
// or from the Fond de plan module (disabledListingIds) are left out.
// Returns { baseMapIds, addListingId (the "+" frame, folder only), ready }.
export default function useScopeGridSheets() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProject: projectId });
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || EMPTY_IDS
  );
  const { disabledListingIds } = useDisabledBaseMapListingIds();
  const { listing } = useScopeListing();
  const filter = useScopeGridAnnotationsFilter();

  // helpers

  const isBaseMapListing = listing?.entityModel?.type === "BASE_MAP";

  // Annotations of the whole scope, narrowed to the selected annotation
  // listing (the business-objects narrowing is an id set, applied below).
  const annotations = useAnnotationsV2({
    caller: "useScopeGridSheets",
    enabled: !isBaseMapListing,
    filterByListingId: filter.filterByListingId,
    filterBySelectedScope: true,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
    // Plan footprints of revolved annotations: the plan hosting the axis
    // gets its sheet too.
    withRevolutionFootprints: true,
  });

  const annotatedBaseMapIdsKey = useMemo(() => {
    if (isBaseMapListing || !annotations) return "";
    const ids = new Set();
    annotations.forEach((a) => {
      if (!a.baseMapId) return;
      if (filter.annotationIdSet && !filter.annotationIdSet.has(a.id)) return;
      ids.add(a.baseMapId);
    });
    return [...ids].sort().join(",");
  }, [annotations, isBaseMapListing, filter.annotationIdSet]);

  return useMemo(() => {
    const hiddenFolderIds = new Set([
      ...hiddenListingsIds,
      ...disabledListingIds,
    ]);
    const visibleBaseMaps = (baseMaps ?? []).filter(
      (baseMap) => !hiddenFolderIds.has(baseMap.listingId)
    );
    if (isBaseMapListing) {
      return {
        baseMapIds: visibleBaseMaps
          .filter((baseMap) => baseMap.listingId === listing.id)
          .map((baseMap) => baseMap.id),
        addListingId: hiddenFolderIds.has(listing.id) ? null : listing.id,
        ready: baseMaps !== undefined,
      };
    }
    const annotatedIds = new Set(
      annotatedBaseMapIdsKey ? annotatedBaseMapIdsKey.split(",") : []
    );
    return {
      baseMapIds: visibleBaseMaps
        .filter((baseMap) => annotatedIds.has(baseMap.id))
        .map((baseMap) => baseMap.id),
      addListingId: null,
      ready: baseMaps !== undefined && annotations !== undefined,
    };
  }, [
    baseMaps,
    hiddenListingsIds,
    disabledListingIds,
    isBaseMapListing,
    listing?.id,
    annotatedBaseMapIdsKey,
    annotations,
  ]);
}
