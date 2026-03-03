import {useLiveQuery} from "dexie-react-hooks";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import db from "App/db/db";

export default function useListingsToDownload() {
  const {value: scope} = useSelectedScope();

  const listingsToDownload = useLiveQuery(async () => {
    if (!scope?.id) return [];
    // listings are now associated via scopeId, no longer via scope.sortedListings
    // missing listings will be fetched during sync
    return [];
  }, [scope?.id]);

  return listingsToDownload;
}
