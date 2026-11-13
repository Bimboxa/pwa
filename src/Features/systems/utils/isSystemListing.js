// A listing that DEFINES a system (see constants/systemConstants.js).
export default function isSystemListing(listing) {
  return Boolean(listing?.system) && !listing.deletedAt;
}
