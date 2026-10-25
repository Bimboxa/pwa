import getBusinessObjectTypeOfListing from "./getBusinessObjectTypeOfListing";

// Located listings: may an object carry SEVERAL main annotations on the same
// base map? The explicit listing flag wins (listing.multipleLocationAnnotations,
// « Plusieurs annotations par plan » in the listing properties); a missing
// flag follows the type feature `multipleLocationsByDefault` (LOCATIONS: a
// location is often several polygons; the other types keep one main per base
// map, replaced at each « Localiser »).
export default function allowsMultipleLocationAnnotations(listing) {
  if (!listing) return false;
  if (typeof listing.multipleLocationAnnotations === "boolean")
    return listing.multipleLocationAnnotations;
  return Boolean(
    getBusinessObjectTypeOfListing(listing).features.multipleLocationsByDefault
  );
}
