import {nanoid} from "@reduxjs/toolkit";
import updateListingRelatedEntitiesWithListingsIds from "../utils/updateListingRelatedEntitiesWithListingsIds";

import db from "App/db/db";
import resolveListingNomenclature from "Features/appConfig/services/resolveListingNomenclature";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default async function resolveListingsToCreateFromPresetListings(
  presetListings
) {
  // edge case
  if (!presetListings) return [];

  let listings = [];

  for (let presetListing of presetListings) {
    let shouldAdd = true;
    presetListing = structuredClone(presetListing);

    // edge case, existing unique by project listings
    if (presetListing.uniqueByProject) {
      const existingListing = await db.listings
        .where("key")
        .equals(presetListing.key)
        .first();
      if (existingListing) shouldAdd = false;
    }

    // resolve nomenclature listings
    if (presetListing.type === "NOMENCLATURE") {
      presetListing = await resolveListingNomenclature(presetListing);
    }

    // add id
    presetListing.id = nanoid();

    // return
    if (shouldAdd) listings.push(presetListing);
  }

  // step 2 - update relatedListings ids

  const listingByKey = getItemsByKey(listings, "key");

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
