import {useState} from "react";

import {useSelector} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

export default function useListingsByScope() {
  // state
  const [loading, setLoading] = useState(true);

  // data
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // listings

  let listings = useLiveQuery(async (params) => {
    // listingsIds
    const rels = await db.relsScopeItem
      .where("[scopeId+itemTable]")
      .equals([selectedScopeId, "listings"])
      .toArray();
    const listingsIds = rels.map((r) => r.itemId);

    // listings
    let listings = await db.listings.bulkGet(listingsIds);
    listings = listings.filter(Boolean);
    setLoading(false);
    return listings;
  });

  return {value: listings, loading};
}
