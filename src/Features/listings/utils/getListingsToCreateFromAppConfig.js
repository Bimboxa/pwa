import {nanoid} from "@reduxjs/toolkit";
import updateListingRelatedEntitiesWithListingsIds from "./updateListingRelatedEntitiesWithListingsIds";

export default function getListingsToCreateFromAppConfig(
  appConfig,
  presetScopeKey
) {
  // edge case
  if (!appConfig || !presetScopeKey) return [];

  //main

  const presetListingsObject = appConfig.presetListingsObject;
  const presetScopesObject = appConfig.presetScopesObject;

  const presetScope = presetScopesObject[presetScopeKey];
  const listingByKey = {};

  // edge case

  if (!presetScope || !presetScope.listings) return [];

  // step 1 - add ids to listings

  let listings = presetScope.listings.map((listingKey) => {
    const listing = presetListingsObject[listingKey];
    const listingId = nanoid();
    //
    const newListing = {
      ...listing,
      id: listingId,
    };
    //
    listingByKey[listingKey] = newListing;
    //
    return newListing;
  });

  // step 2 - update relatedListings ids

  listings = listings.map((listing) => {
    if (listing.relatedEntities) {
      const relatedEntities = updateListingRelatedEntitiesWithListingsIds(
        listing.relatedEntities,
        listingByKey
      );
      return {
        ...listing,
        relatedEntities,
      };
    } else {
      return listing;
    }
  });

  return listings;
}
