import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { isLegacyStyleRevolutionHelper } from "Features/annotations/constants/drawingShapeConfig";
import { isTemplatelessAnnotationInScope } from "Features/annotations/utils/templatelessAnnotations";

// ---------------------------------------------------------------------------
// usePopperBaseMapsCounts — annotation counts per base map of the Dessin
// popper / docked panel, aligned on the listing counters of the annotations
// side: per base map, the annotations of the listings displayed AND visible
// in the popper (hidden listings excluded) plus the templateless ones of the
// scope — computed scope-wide. (The top bar badge keeps the whole count of
// the base map, see useAnnotationsCountByBaseMapId.)
//
// Feeds:
// - the « X annotations sur N fonds de plan » band under the header
//   (BandAnnotationsSummary): N = base maps whose annotations the editor
//   displays (`displayedBaseMapIds` — main eye, 2D overlay badges, 3D display
//   modes) among those carrying at least one counted annotation, X = their
//   annotations;
// - the count pills of the "Fonds de plan" side (SectionBaseMapsList,
//   `countByBaseMapIdOverride`).
// ---------------------------------------------------------------------------

export default function usePopperBaseMapsCounts({
  // Ids of the listings displayed in the popper (their counters).
  listingIds,
  // Ids of the base maps whose annotations the displayed editor shows.
  displayedBaseMapIds,
  enabled = true,
}) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  // Scope-wide annotations set, same filters as the popper's counters
  // (allAnnotations of PopperMapListings) without the main base map one.
  const scopeAnnotations = useAnnotationsV2({
    caller: "usePopperBaseMapsCounts",
    enabled,
    filterBySelectedScope: true,
    // blocks context: on a blocks base map, the blocks base maps' counts
    filterByBlocksContext: true,
    hideBaseMapAnnotations: true,
    ignoreSolo: true,
  });

  // helpers

  const listingIdsKey = (listingIds ?? []).join("|");
  const hiddenListingIdsKey = hiddenListingsIds.join("|");
  const countByBaseMapId = useMemo(() => {
    const hiddenSet = new Set(
      hiddenListingIdsKey ? hiddenListingIdsKey.split("|") : []
    );
    const listingIdSet = new Set(
      (listingIdsKey ? listingIdsKey.split("|") : []).filter(
        (id) => !hiddenSet.has(id)
      )
    );
    const counts = {};
    (scopeAnnotations ?? []).forEach((a) => {
      if (!a.baseMapId || isLegacyStyleRevolutionHelper(a)) return;
      const counted = a.listingId
        ? listingIdSet.has(a.listingId)
        : isTemplatelessAnnotationInScope(a, selectedScopeId);
      if (counted) counts[a.baseMapId] = (counts[a.baseMapId] ?? 0) + 1;
    });
    return counts;
  }, [scopeAnnotations, listingIdsKey, hiddenListingIdsKey, selectedScopeId]);

  const displayedCounts = (displayedBaseMapIds ?? []).map(
    (id) => countByBaseMapId[id] ?? 0
  );
  const displayedBaseMapsCount = displayedCounts.filter((n) => n > 0).length;
  const displayedAnnotationsCount = displayedCounts.reduce((a, n) => a + n, 0);

  return {
    countByBaseMapId,
    displayedAnnotationsCount,
    displayedBaseMapsCount,
  };
}
