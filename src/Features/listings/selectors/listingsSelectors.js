import { createSelectorCreator, lruMemoize } from "reselect";
import isEqual from "fast-deep-equal";

import getSortedListings from "../utils/getSortedListings";

const createDeepEqualSelector = createSelectorCreator(lruMemoize, isEqual);

export const makeGetListingsByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.listings.listingsUpdatedAt,
      (state) => state.listings.listingsById,
      (state) => state.appConfig.value?.entityModelsObject,
      (state) => state.scopes.scopesById[options?.filterByScopeId],
    ],
    (listingsUpdatedAt, listingsById, entityModelsObject, scope) => {
      // options

      const filterByProjectId = options?.filterByProjectId;
      const filterByScopeId = options?.filterByScopeId;
      const withEntityModel = options?.withEntityModel;
      const filterByKeys = options?.filterByKeys;
      const filterByListingsIds = options?.filterByListingsIds;
      const mapsOnly = options?.mapsOnly;

      // edge case

      if (!listingsUpdatedAt) return [];

      // main

      let listings = Object.values(listingsById ?? {}) ?? [];

      if (filterByProjectId) {
        listings = listings.filter((l) => l.projectId === filterByProjectId);
      }

      if (filterByScopeId) {
        listings = getSortedListings(listings, scope?.sortedListings);
      }
      console.log("listings1", filterByScopeId, listings);

      // filter
      if (filterByKeys) {
        listings = listings?.filter((l) => filterByKeys.includes(l?.key));
      }
      if (filterByListingsIds) {
        listings = listings?.filter((l) => filterByListingsIds.includes(l?.id));
      }

      // relations. Need entityModel for mapsOnly
      if (withEntityModel || mapsOnly) {
        listings = listings?.map((listing) => {
          return {
            ...listing,
            entityModel: entityModelsObject?.[listing?.entityModelKey] ?? null,
          };
        });
      }

      if (mapsOnly) {
        listings = listings?.filter((l) => l?.entityModel?.type === "MAP");
      }

      return listings;
    }
  );
