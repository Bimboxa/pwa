import { createSelectorCreator, lruMemoize } from "reselect";
import isEqual from "fast-deep-equal";

import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

const createDeepEqualSelector = createSelectorCreator(lruMemoize, isEqual);

export const makeGetListingsByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.listings.listingsUpdatedAt,
      (state) => state.listings.listingsById,
      (state) => state.appConfig.value?.entityModelsObject,
    ],
    (listingsUpdatedAt, listingsById, entityModelsObject) => {
      // options

      const filterByProjectId = options?.filterByProjectId;
      const filterByScopeId = options?.filterByScopeId;
      const filterByKeys = options?.filterByKeys;
      const filterByListingsIds = options?.filterByListingsIds;
      const baseMapsOnly = options?.baseMapsOnly;

      // edge case

      if (!listingsUpdatedAt) return [];

      // main

      let listings = Object.values(listingsById ?? {}) ?? [];

      const test = testObjectHasProp(options, "filterByProjectId");
      if (test) {
        listings = listings.filter((l) => l.projectId === filterByProjectId);
      }

      // add entity model (fallback for listings created before entityModel was stored)
      listings = listings?.map((listing) => {
        if (listing.entityModel) return listing;
        const entityModel =
          entityModelsObject?.[listing?.entityModelKey] ?? null;
        return entityModel ? { ...listing, entityModel } : listing;
      });

      if (filterByScopeId) {
        const sharedListings = listings.filter((l) =>
          ["BASE_MAP", "BLUEPRINT"].includes(l?.entityModel?.type)
        );
        const scopedListings = listings.filter(
          (l) => l.scopeId === filterByScopeId
        );
        listings = [...sharedListings, ...scopedListings];
      }

      // filter
      if (filterByKeys) {
        listings = listings?.filter((l) => filterByKeys.includes(l?.key));
      }
      if (filterByListingsIds) {
        listings = listings?.filter((l) => filterByListingsIds.includes(l?.id));
      }

      if (baseMapsOnly) {
        listings = listings?.filter((l) => l?.entityModel?.type === "BASE_MAP");
      }

      return listings;
    }
  );
