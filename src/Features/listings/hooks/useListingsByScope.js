import {useState} from "react";

import {useSelector} from "react-redux";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getEntityModelAsync from "App/services/getEntityModel";
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
  const {value: selectedScope} = useSelectedScope();

  // helpers
  const sortedListingsIds = selectedScope?.sortedListingsIds || [];

  // listings

  const keysHash = (filterByKeys ?? []).sort().join(",");
  const idsHash = (filterByListingsIds ?? []).sort().join(",");

  let listings = useLiveQuery(async () => {
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

    if (withEntityModel) {
      listings = await Promise.all(
        listings.map(async (listing) => {
          return {
            ...listing,
            entityModel: await getEntityModelAsync(listing?.entityModelKey),
          };
        })
      );
    }

    if (mapsOnly) {
      listings = listings.filter((l) => l?.entityModel?.type === "MAP");
    }

    setLoading(false);
    return listings;
  }, [keysHash, idsHash, selectedScopeId]);

  if (sortFromScope) {
    listings = getSortedListings(listings, sortedListingsIds);
  }

  return {value: listings, loading};
}
