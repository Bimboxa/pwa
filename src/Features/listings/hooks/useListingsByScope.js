import {useState} from "react";

import {useSelector} from "react-redux";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getSortedListings from "../utils/getSortedListings";

export default function useListingsByScope(options) {
  // options

  const withEntityModel = options?.withEntityModel;
  const filterByKeys = options?.filterByKeys;
  const filterByListingsIds = options?.filterByListingsIds;
  const sortFromScope = options?.sortFromScope;
  const mapsOnly = options?.mapsOnly;

  // state
  const [loading, setLoading] = useState(true);

  // data
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const {value: selectedScope, loading: loadingScope} = useSelectedScope();
  const appConfig = useAppConfig();

  // helpers
  const sortedListingsIds = selectedScope?.sortedListingsIds || []; // ?

  // listings

  const keysHash = (filterByKeys ?? []).sort().join(",");
  const idsHash = (filterByListingsIds ?? []).sort().join(",");

  let listings = useLiveQuery(async () => {
    // edge cases

    if (!selectedScope && !loadingScope) {
      setLoading(false);
      return null;
    } else if (!selectedScope) {
      return null;
    }

    // edge case - 0 listingsIds

    if (sortedListingsIds.length === 0) {
      setLoading(false);
      return [];
    }

    //main
    console.log("[db] fetching listings 44", filterByKeys);
    // listingsIds from scope
    const rels = await db.relsScopeItem
      .where("[scopeId+itemTable]")
      .equals([selectedScopeId, "listings"])
      .toArray();

    const listingsIds = rels.map((r) => r.itemId);

    // listings
    let listings = await db.listings.bulkGet(listingsIds);
    listings = listings.filter(Boolean);

    // filter
    if (filterByKeys) {
      listings = listings.filter((l) => filterByKeys.includes(l?.key));
    }
    if (filterByListingsIds) {
      listings = listings.filter((l) => filterByListingsIds.includes(l?.id));
    }
    if (mapsOnly) {
      listings = listings.filter((l) => l?.entityModel?.type === "MAP");
    }

    // relation
    if (withEntityModel) {
      listings = await Promise.all(
        listings.map(async (listing) => {
          return {
            ...listing,
            entityModel:
              appConfig?.entityModelsObject?.[listing?.entityModelKey] ?? null,
          };
        })
      );
    }

    setLoading(false);
    return listings;
  }, [keysHash, idsHash, selectedScopeId, mapsOnly, loadingScope]);

  if (sortFromScope) {
    listings = getSortedListings(listings, sortedListingsIds);
  }

  return {value: listings, loading};
}
