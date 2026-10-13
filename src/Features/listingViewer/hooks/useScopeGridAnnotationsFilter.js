import { useMemo } from "react";
import { useSelector } from "react-redux";

import useRelsBusinessObjectAnnotation from "Features/businessObjects/hooks/useRelsBusinessObjectAnnotation";
import useScopeListing from "./useScopeListing";

const INACTIVE = {
  active: false,
  filterByListingId: undefined,
  annotationIdSet: null,
};

// What the sheets of the SCOPE module's grid (2D and 3D) draw: the
// annotations of the listing selected in the scope panel. Inactive outside
// the module and in the "Afficher toutes les listes" mode. Per listing kind:
//   - annotation listing (LOCATED_ENTITY) -> the
//     annotations of that listing (filterByListingId);
//   - business-objects listing -> the annotations LINKED to its objects
//     (annotationIdSet, from the rels — the listing owns no annotation);
//   - base map listing -> no annotation filter (the sheets are the folder's
//     base maps instead, see useScopeGridSheets).
// Returns { active, filterByListingId, annotationIdSet }.
export default function useScopeGridAnnotationsFilter() {
  const isScopeModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "SCOPE"
  );
  const { listing } = useScopeListing();

  const type = isScopeModule ? listing?.entityModel?.type : null;
  const isAnnotationListing = type === "LOCATED_ENTITY";
  const isBusinessObjectListing = type === "BUSINESS_OBJECT";

  const { value: rels } = useRelsBusinessObjectAnnotation({
    listingId: isBusinessObjectListing ? listing.id : undefined,
  });
  // The liveQuery emits a new array on every change: key the set on its
  // content so an unchanged set keeps its identity (the 3D loader rebuilds
  // on a new filter result).
  const relsKey = useMemo(
    () =>
      isBusinessObjectListing
        ? [...new Set((rels ?? []).map((rel) => rel.annotationId))]
            .sort()
            .join(",")
        : "",
    [rels, isBusinessObjectListing]
  );

  return useMemo(() => {
    if (isAnnotationListing) {
      return {
        active: true,
        filterByListingId: listing.id,
        annotationIdSet: null,
      };
    }
    if (isBusinessObjectListing) {
      return {
        active: true,
        filterByListingId: undefined,
        annotationIdSet: new Set(relsKey ? relsKey.split(",") : []),
      };
    }
    return INACTIVE;
  }, [isAnnotationListing, isBusinessObjectListing, listing?.id, relsKey]);
}
