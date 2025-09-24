import { createSelectorCreator, lruMemoize } from "reselect";
import isEqual from "fast-deep-equal";

import getSortedListings from "../utils/getSortedListings";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

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
      const baseMapsOnly = options?.baseMapsOnly;

      // edge case

      if (!listingsUpdatedAt) return [];

      // main

      let listings = Object.values(listingsById ?? {}) ?? [];

      const test = testObjectHasProp(options, "filterByProjectId");
      console.log("debug_2409_test", test, options);
      if (test) {
        listings = listings.filter((l) => l.projectId === filterByProjectId);
      }

      // add entity model
      listings = listings?.map((listing) => {
        return {
          ...listing,
          entityModel: entityModelsObject?.[listing?.entityModelKey] ?? null,
        };
      });

      if (filterByScopeId) {
        const sharedListings = listings.filter((l) =>
          ["BASE_MAP", "BLUEPRINT"].includes(l?.entityModel?.type)
        );
        const scopedListings = listings.filter(
          (l) => !["BASE_MAP", "BLUEPRINT"].includes(l?.entityModel?.type)
        );
        listings = [
          ...sharedListings,
          ...getSortedListings(scopedListings, scope?.sortedListings),
        ];
      }
      console.log("listings1", filterByScopeId, listings);

      // filter
      if (filterByKeys) {
        listings = listings?.filter((l) => filterByKeys.includes(l?.key));
      }
      if (filterByListingsIds) {
        listings = listings?.filter((l) => filterByListingsIds.includes(l?.id));
      }

      // relations. Need entityModel for baseMapsOnly
      if (withEntityModel || baseMapsOnly) {
        listings = listings?.map((listing) => {
          return {
            ...listing,
            entityModel: entityModelsObject?.[listing?.entityModelKey] ?? null,
          };
        });
      }

      if (baseMapsOnly) {
        listings = listings?.filter((l) => l?.entityModel?.type === "BASE_MAP");
      }

      return listings;
    }
  );
