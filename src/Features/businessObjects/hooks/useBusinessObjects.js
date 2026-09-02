import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useBusinessObjects({ listingId, scopeId } = {}) {
  // trigger

  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );

  // main

  const businessObjects = useLiveQuery(async () => {
    let collection;
    if (listingId) {
      collection = db.businessObjects.where("listingId").equals(listingId);
    } else if (scopeId) {
      collection = db.businessObjects.where("scopeId").equals(scopeId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((o) => !o.deletedAt);
  }, [listingId, scopeId, businessObjectsUpdatedAt]);

  return { value: businessObjects, loading: businessObjects === undefined };
}
