import useListingsByScope from "Features/listings/hooks/useListingsByScope";

// Candidate target listings for the object library: scoped LOCATED_ENTITY
// listings, excluding baseMap listings and the system "Annotations libres"
// (free-annotations) listing.
export default function useObjectsTargetListings() {
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  return (listings ?? []).filter((l) => !l.isFreeAnnotationsListing);
}
