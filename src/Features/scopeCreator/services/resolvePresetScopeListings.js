/*
 * we compute the listings to create from the preset scope of the config.
 * props to add :
 * - id (for unique list in project like nomenclatures)
 * - projectId
 *
 * TODO - add relatedListings (cf resolvePresetListings.js)
 */

import { nanoid } from "@reduxjs/toolkit";
import resolveListingsToCreateFromPresetListings from "Features/listings/services/resolveListingsToCreateFromPresetListings";

export default async function resolvePresetScopeListings({
  presetScopeKey,
  appConfig,
  projectId,
}) {
  // edge case

  if (
    !appConfig ||
    !appConfig.presetListingsObject ||
    !appConfig.presetScopesObject
  )
    return [];

  // helpers - presetScope

  const presetScope = appConfig?.presetScopesObject[presetScopeKey];
  const entityModelsObject = appConfig?.entityModelsObject ?? {};

  // helpers - presetListings

  const presetListings = presetScope?.listings.map((listingKey) => {
    return appConfig.presetListingsObject[listingKey];
  });

  // main

  // step 0 - filter out projectDataset

  let listings = presetListings?.filter((listing) => Boolean(listing));

  // step 1 - add id & projectId to listings

  // listings = listings?.map((listing) => {
  //   return {
  //     ...listing,
  //     id: nanoid(),
  //     projectId,
  //     entityModel: entityModelsObject[listing.entityModelKey],
  //     canCreateItem: true,
  //   };
  // });


  listings = await resolveListingsToCreateFromPresetListings(
    listings,
    appConfig,
    projectId,
  );


  // return

  return listings;
}
