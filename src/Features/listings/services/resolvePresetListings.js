/*
 * we compute the listings to create from the presets of the config.
 * props to add :
 * - id (for unique list in project like nomenclatures)
 * - relatedListings: ex {nomenclature: {id}, zones: xxx}. Used to get the listings related to the entityTemplate.
 * - exists: if the listing already exists in the DB.
 */
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
import updateListingRelatedEntitiesWithListingsIds from "../utils/updateListingRelatedEntitiesWithListingsIds";

import db from "App/db/db";
import resolveListingNomenclature from "Features/appConfig/services/resolveListingNomenclature";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default async function resolvePresetListings({
  projectId,
  scopeId,
  appConfig,
  presetListingsKeys,
}) {
  // edge case

  if (!appConfig || !appConfig.presetListingsObject || !projectId) return [];

  // helpers

  const { presetListingsObject } = appConfig;
  const presetListings = presetListingsKeys
    ? presetListingsKeys.map((key) => presetListingsObject[key]).filter(Boolean)
    : Object.values(presetListingsObject);

  const projectListings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();

  // main

  let listings = [];
  let prevRank = null;

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

    // articlesNomenclatures — resolve keys into full objects
    if (presetListing.articlesNomenclaturesKeys?.length > 0) {
      const articlesNomenclaturesObject = appConfig.articlesNomenclaturesObject ?? {};
      presetListing.articlesNomenclatures = presetListing.articlesNomenclaturesKeys
        .map((key) => articlesNomenclaturesObject[key])
        .filter(Boolean);
      delete presetListing.articlesNomenclaturesKeys;
    }

    // existing listing
    let existingListing;
    if (presetListing.uniqueByProject) {
      existingListing = projectListings.find(
        (l) => l.key === presetListing.key
      );
    }

    // resolve nomenclature listings
    if (presetListing.type === "NOMENCLATURE") {
      presetListing = resolveListingNomenclature(presetListing, appConfig);
    }

    // add id & projectId
    presetListing.id = existingListing?.id ?? nanoid();
    presetListing.projectId = projectId;

    // rank (fractional indexing for display order)
    const rank = generateKeyBetween(prevRank, null);
    prevRank = rank;
    presetListing.rank = existingListing?.rank ?? rank;

    // scope id

    if (["LOCATED_ENTITY", "BLUEPRINT", "PORTFOLIO_PAGE"].includes(entityModel.type)) {
      presetListing.scopeId = scopeId;
    }

    // sprite image

    if (presetListing.spriteImageKey) {
      presetListing.spriteImage =
        appConfig?.features?.annotations?.spriteImages?.find(
          ({ key }) => key === presetListing.spriteImageKey
        );
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
