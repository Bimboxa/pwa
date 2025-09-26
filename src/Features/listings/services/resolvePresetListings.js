/*
 * we compute the listings to create from the presets of the config.
 * props to add :
 * - id (for unique list in project like nomenclatures)
 * - relatedListings: ex {nomenclature: {id}, zones: xxx}. Used to get the listings related to the entityTemplate.
 * - exists: if the listing already exists in the DB.
 */
import { nanoid } from "@reduxjs/toolkit";
import updateListingRelatedEntitiesWithListingsIds from "../utils/updateListingRelatedEntitiesWithListingsIds";

import db from "App/db/db";
import resolveListingNomenclature from "Features/appConfig/services/resolveListingNomenclature";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default async function resolvePresetListings({
  projectId,
  scopeId,
  appConfig,
}) {
  // edge case

  if (!appConfig || !appConfig.presetListingsObject || !projectId) return [];

  // helpers

  const { presetListingsObject } = appConfig;
  const presetListings = Object.values(presetListingsObject);

  const projectListings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();

  // main

  let listings = [];

  for (let presetListing of presetListings) {
    let shouldAdd = true;
    presetListing = structuredClone(presetListing);

    // entityModel

    const entityModel =
      appConfig.entityModelsObject[presetListing.entityModelKey];
    presetListing.entityModel = entityModel;

    // icon & colors

    presetListing.iconKey =
      presetListing?.iconKey ?? entityModel.defaultIconKey;
    presetListing.color = presetListing?.color ?? entityModel.defaultColor;
    presetListing.spriteImageKey =
      presetListing?.spriteImageKey ?? entityModel.defaultSpriteImageKey;

    // existing listing
    let existingListing;
    if (presetListing.uniqueByProject) {
      existingListing = projectListings.find(
        (l) => l.key === presetListing.key
      );
    }

    // resolve nomenclature listings
    if (presetListing.type === "NOMENCLATURE") {
      presetListing = await resolveListingNomenclature(presetListing);
    }

    // add id & projectId
    presetListing.id = existingListing?.id ?? nanoid();
    presetListing.projectId = projectId;

    // scope id

    if (["LOCATED_ENTITY", "BLUEPRINT"].includes(entityModel.type)) {
      presetListing.scopeId = scopeId;
    }

    // can create item
    presetListing.canCreateItem = true;

    // return
    // if (shouldAdd) listings.push(presetListing);
    listings.push(presetListing);
  }

  // step 2 - relatedListings

  let listingByKey = getItemsByKey(listings, "key");
  listings = listings.map((listing) => {
    if (listing.relatedListings) {
      const relatedListings = {};
      Object.entries(listing.relatedListings).map(([fieldKey, listingKey]) => {
        relatedListings[fieldKey] = listingByKey[listingKey];
      });
      return { ...listing, relatedListings };
    } else {
      return listing;
    }
  });

  // step 3 - update relatedListings ids

  listingByKey = getItemsByKey(listings, "key");

  listings = listings.map((listing) => {
    let newListing = { ...listing };
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
