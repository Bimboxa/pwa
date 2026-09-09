import {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  getBusinessObjectType,
} from "../data/businessObjectTypesCatalog";

// Type entry (strings + features) of a business-object listing. Listings
// written before the types existed (no businessObjectType) and unknown keys
// read as STANDARD.
export default function getBusinessObjectTypeOfListing(listing) {
  return (
    getBusinessObjectType(
      listing?.businessObjectType ?? DEFAULT_BUSINESS_OBJECT_TYPE_KEY
    ) ?? getBusinessObjectType(DEFAULT_BUSINESS_OBJECT_TYPE_KEY)
  );
}
