import {useState} from "react";

import {useSelector} from "react-redux";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getEntityModelAsync from "App/services/getEntityModel";

export default function useListingsByScope(options) {
  // options

  const withEntityModel = options?.withEntityModel;
  const filterByKeys = options?.filterByKeys;

  // state
  const [loading, setLoading] = useState(true);

  // data
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // listings

  let listings = useLiveQuery(
    async (params) => {
      // listingsIds
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
      setLoading(false);
      return listings;
    },
    [filterByKeys, selectedScopeId]
  );

  return {value: listings, loading};
}
