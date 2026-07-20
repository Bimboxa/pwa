import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useZones({ listingId, scopeId } = {}) {
  // trigger

  const zonesUpdatedAt = useSelector((s) => s.zonings.zonesUpdatedAt);

  // main

  const zones = useLiveQuery(async () => {
    let collection;
    if (listingId) {
      collection = db.zones.where("listingId").equals(listingId);
    } else if (scopeId) {
      collection = db.zones.where("scopeId").equals(scopeId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((z) => !z.deletedAt);
  }, [listingId, scopeId, zonesUpdatedAt]);

  return { value: zones, loading: zones === undefined };
}
