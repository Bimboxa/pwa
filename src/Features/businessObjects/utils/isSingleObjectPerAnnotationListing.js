import getBusinessObjectTypeOfListing from "./getBusinessObjectTypeOfListing";

// Exclusive listings (type feature `singleObjectPerAnnotation`, e.g. the
// locations): an annotation is linked to at most ONE object of the listing.
export default function isSingleObjectPerAnnotationListing(listing) {
  return Boolean(
    listing &&
    getBusinessObjectTypeOfListing(listing).features.singleObjectPerAnnotation
  );
}
