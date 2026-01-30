// THE FILE TO RESOLVE LISTINGS TO CREATE FROM PRESET LISTINGS

import { nanoid } from "@reduxjs/toolkit";
import updateListingRelatedEntitiesWithListingsIds from "../utils/updateListingRelatedEntitiesWithListingsIds";

import db from "App/db/db";
import resolveListingNomenclature from "Features/appConfig/services/resolveListingNomenclature";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default async function resolveListingsToCreateFromPresetListings(
  presetListings,
  appConfig,
  projectId,
) {

  console.log("debug_3001_presetListings", presetListings);

  // edge case
  if (!presetListings) return [];

  let listings = [];

  for (let presetListing of presetListings) {
    let shouldAdd = true;
    presetListing = structuredClone(presetListing);

    // add id
    presetListing.id = nanoid();

    // add projectId
    presetListing.projectId = projectId;

    // edge case, existing unique by project listings
    if (presetListing.uniqueByProject) {
      const existingListing = await db.listings
        .where("key")
        .equals(presetListing.key)
        .first();
      if (existingListing) shouldAdd = false;
    }

    // add entityModel

    const entityModel =
      appConfig.entityModelsObject[presetListing.entityModelKey];
    presetListing.entityModel = entityModel;

    // resolve nomenclature listings
    if (presetListing.type === "NOMENCLATURE") {
      presetListing = resolveListingNomenclature(
        presetListing,
        appConfig
      );
    }

    // return
    if (shouldAdd) listings.push(presetListing);
  }

  // step 2 - update relatedListings ids

  const listingByKey = getItemsByKey(listings, "key");

  listings = listings.map((listing) => {
    let newListing = { ...listing };
    if (listing.relatedEntities) {
      const relatedEntities = updateListingRelatedEntitiesWithListingsIds(
        listing.relatedEntities,
        listingByKey
      );
      newListing.relatedEntities = relatedEntities;
    }

    if (listing.relatedListings) {
      const relatedListings = {};
      Object.entries(listing.relatedListings).forEach(
        ([fieldKey, listingKey]) => {
          relatedListings[fieldKey] = listingByKey[listingKey];
        }
      );
      newListing.relatedListings = relatedListings;
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
