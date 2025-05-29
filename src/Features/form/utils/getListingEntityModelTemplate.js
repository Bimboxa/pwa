export default function getListingEntityModelTemplate({listing, listings}) {
  // edge case

  console.log("listing", listing);
  if (!listing) return null;

  // helpers

  const entityModel = listing?.entityModel;

  // main

  let fields = entityModel?.fieldsObject
    ? Object.values(entityModel.fieldsObject)
    : [];

  fields = fields.map((field) => {
    const _field = {};
    Object.entries(field).map(([key, value]) => {
      if (value.listingKey) {
        const _relatedListing = listing.relatedListings[value.listingKey];
        const relatedListing = listings.find(
          (listing) => listing.id === _relatedListing.id
        ); // since the listing was resolved, the related listing probably changed.
        console.log("relatedListing", relatedListing, _relatedListing);
        if (key === "nomenclature") {
          _field[key] = relatedListing?.metadata?.nomenclature;
        }
      } else {
        _field[key] = value;
      }
    });
    return _field;
  });

  return {
    fields,
  };
}
