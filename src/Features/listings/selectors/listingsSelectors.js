import { createSelectorCreator, lruMemoize } from "reselect";
import isEqual from "fast-deep-equal";

import testObjectHasProp from "Features/misc/utils/testObjectHasProp";
import getLinkedListingIdsForScope from "../utils/getLinkedListingIdsForScope";

const createDeepEqualSelector = createSelectorCreator(lruMemoize, isEqual);

const EMPTY_OBJECT = Object.freeze({});

// {[listingId]: sourceScopeId} of the listings LINKED into the selected scope
// from other scopes ("Depuis un autre Krto") — displayable links only (source
// listing + scope loaded locally, see getLinkedListingIdsForScope). Stable
// EMPTY_OBJECT while nothing is linked. Consumed by useLinkedListings (UI
// read-only affordances) and useAnnotationsV2 (scope filter).
export const selectLinkedListingSourceForSelectedScope =
  createDeepEqualSelector(
    [
      (state) => state.scopes.selectedScopeId,
      (state) => state.listings.linkedListingSourceByScopeId,
      (state) => state.listings.listingsById,
      (state) => state.scopes.scopesById,
    ],
    (scopeId, linkedSourceByScopeId, listingsById, scopesById) => {
      const ids = getLinkedListingIdsForScope({
        linkedSourceByScopeId,
        scopeId,
        listingsById,
        scopesById,
      });
      if (ids.size === 0) return EMPTY_OBJECT;
      const linked = linkedSourceByScopeId?.[scopeId] ?? {};
      const result = {};
      for (const id of ids) {
        result[id] = linked[id] ?? listingsById?.[id]?.scopeId ?? null;
      }
      return result;
    }
  );

export const makeGetListingsByOptions = (options) =>
  createDeepEqualSelector(
    [
      (state) => state.listings.listingsUpdatedAt,
      (state) => state.listings.listingsById,
      (state) => state.appConfig.value?.entityModelsObject,
      (state) => state.scopes.scopesById,
      (state) => state.appConfig.value?.presetScopesObject,
      (state) => state.listings.linkedListingSourceByScopeId,
    ],
    (
      listingsUpdatedAt,
      listingsById,
      entityModelsObject,
      scopesById,
      presetScopesObject,
      linkedListingSourceByScopeId
    ) => {
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

      // sort: use rank if available, otherwise fallback to appConfig order
      const hasRank = listings.some((l) => l.rank != null);
      if (hasRank) {
        listings.sort((a, b) => {
          const aRank = a.rank ?? "";
          const bRank = b.rank ?? "";
          return String(aRank).localeCompare(String(bRank));
        });
      } else if (filterByScopeId && scopesById && presetScopesObject) {
        const scope = scopesById[filterByScopeId];
        const presetScope = scope?.presetScopeKey
          ? presetScopesObject[scope.presetScopeKey]
          : null;
        if (presetScope?.listings) {
          const keyOrder = presetScope.listings;
          listings.sort((a, b) => {
            const aIdx = keyOrder.indexOf(a.key);
            const bIdx = keyOrder.indexOf(b.key);
            return (
              (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx)
            );
          });
        }
      }

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

      // scope filter: shared (BASE_MAP, PHOTO) + scoped listings + listings
      // LINKED from other scopes (db.relsScopeListing, "Depuis un autre
      // Krto"). Linked listings keep their own scopeId (paternity) and are
      // appended AFTER the scope's own listings: their ranks belong to the
      // source scope's order and must never interleave with the host's.
      if (filterByScopeId) {
        const linkedIds = getLinkedListingIdsForScope({
          linkedSourceByScopeId: linkedListingSourceByScopeId,
          scopeId: filterByScopeId,
          listingsById,
          scopesById,
        });
        const own = [];
        const linked = [];
        for (const l of listings) {
          if (
            l?.entityModel?.type === "BASE_MAP" ||
            l?.entityModel?.type === "PHOTO" ||
            l.scopeId === filterByScopeId
          ) {
            own.push(l);
          } else if (linkedIds.has(l.id)) {
            linked.push(l);
          }
        }
        listings = linked.length > 0 ? [...own, ...linked] : own;
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
