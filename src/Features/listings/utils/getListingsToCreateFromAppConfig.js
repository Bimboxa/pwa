import {nanoid} from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
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

  const presetScope = presetScopesObject?.[presetScopeKey];
  const listingByKey = {};

  // edge case

  if (!presetScope || !presetScope.listings) return [];

  // step 1 - add ids to listings

  let prevRank = null;
  let listings = presetScope.listings.map((listingKey) => {
    const listing = presetListingsObject[listingKey];
    const listingId = nanoid();
    const rank = generateKeyBetween(prevRank, null);
    prevRank = rank;
    //
    const newListing = {
      ...listing,
      id: listingId,
      rank,
    };
    //
    listingByKey[listingKey] = newListing;
    //
    return newListing;
  });

  // step 2 - update relatedListings ids

  listings = listings.map((listing) => {
    let newListing = {...listing};
    if (listing.relatedEntities) {
      const relatedEntities = updateListingRelatedEntitiesWithListingsIds(
        listing.relatedEntities,
        listingByKey
      );
      newListing.relatedEntities = relatedEntities;
    }

    if (listing.relatedListing) {
      const fullRelatedListing = listingByKey[listing.relatedListing.key];
      if (fullRelatedListing) {
        newListing.relatedListing = {
          ...listing.relatedListing,
          id: fullRelatedListing.id,
        };
      }
    }

    return newListing;
  });

  return listings;
}
