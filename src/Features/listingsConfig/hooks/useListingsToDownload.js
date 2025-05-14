import {useLiveQuery} from "dexie-react-hooks";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import db from "App/db/db";

export default function useListingsToDownload() {
  const {value: scope} = useSelectedScope();

  const listingsToDownload = useLiveQuery(async () => {
    const scopeListings = scope?.sortedListings;
    let _listingsToDownload = [];
    if (!scope?.id || !scopeListings || scopeListings.length === 0) return [];
    for (let listing of scopeListings) {
      const listingInDb = await db.listings.get(listing.id);

      if (!listingInDb) _listingsToDownload.push(listing);
    }
    return _listingsToDownload;
  }, [scope?.id]);

  return listingsToDownload;
}
