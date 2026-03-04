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
      const filterByEntityModelType = options?.filterByEntityModelType;
      const relsZoneEntityListings = options?.relsZoneEntityListings;
      const baseMapsOnly = options?.baseMapsOnly;
      const filterByIsForBaseMaps = options?.filterByIsForBaseMaps;
      const excludeIsForBaseMaps = options?.excludeIsForBaseMaps;

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

      // scope filter: shared (BASE_MAP) + scoped listings
      if (filterByScopeId) {
        listings = listings.filter(
          (l) =>
            l?.entityModel?.type === "BASE_MAP" ||
            l.scopeId === filterByScopeId
        );
      }

      // filter by entity model type
      if (filterByEntityModelType) {
        listings = listings.filter(
          (l) => l?.entityModel?.type === filterByEntityModelType
        );
      }

      // filter
      if (filterByKeys) {
        listings = listings?.filter((l) => filterByKeys.includes(l?.key));
      }
      if (filterByListingsIds) {
        listings = listings?.filter((l) => filterByListingsIds.includes(l?.id));
      }

      if (relsZoneEntityListings) {
        listings = listings.filter((l) =>
          Boolean(l?.entityModel?.relsZoneEntity)
        );
      }

      if (baseMapsOnly) {
        listings = listings?.filter((l) => l?.entityModel?.type === "BASE_MAP");
      }

      if (filterByIsForBaseMaps === true) {
        listings = listings?.filter((l) => l?.isForBaseMaps === true);
      }

      if (excludeIsForBaseMaps === true) {
        listings = listings?.filter((l) => !l?.isForBaseMaps);
      }

      return listings;
    }
  );
