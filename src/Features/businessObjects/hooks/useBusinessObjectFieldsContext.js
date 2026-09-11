import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { getFieldsReferencedListingIds } from "../utils/businessObjectFieldValues";

// Resolution context of the listing-model field values
// (businessObjectFieldValues ctx) for a set of fields: the objects of the
// referenced listings (category nomenclatures, link targets) indexed by
// local id and by Krnet id, the local → remote listing id map, the state
// models. Built once per panel / tree; every hook runs unconditionally
// (empty inputs when `enabled` is false).
export default function useBusinessObjectFieldsContext({
  fields,
  stateModelById,
  enabled = true,
}) {
  // data

  const listingsById = useSelector((s) => s.listings.listingsById);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );

  // helpers

  const referencedListingIds = useMemo(
    () => (enabled ? getFieldsReferencedListingIds(fields) : []),
    [enabled, fields]
  );
  const referencedIdsKey = referencedListingIds.join("|");

  const remoteListingIdByLocalId = useMemo(() => {
    const out = {};
    for (const id of referencedListingIds) {
      const idMaster = listingsById?.[id]?.idMaster;
      if (idMaster) out[id] = idMaster;
    }
    return out;
  }, [referencedListingIds, listingsById]);

  const referencedObjects = useLiveQuery(
    () =>
      referencedListingIds.length
        ? db.businessObjects
            .where("listingId")
            .anyOf(referencedListingIds)
            .toArray()
        : [],
    [referencedIdsKey, businessObjectsUpdatedAt],
    []
  );

  return useMemo(() => {
    const objectById = {};
    const categoryLocalIdByIdMaster = {};
    const objectsByListingId = {};
    for (const o of referencedObjects ?? []) {
      if (o.deletedAt) continue;
      objectById[o.id] = o;
      if (o.idMaster) categoryLocalIdByIdMaster[o.idMaster] = o.id;
      (objectsByListingId[o.listingId] ??= []).push(o);
    }
    for (const list of Object.values(objectsByListingId)) {
      list.sort((a, b) =>
        String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
      );
    }
    return {
      stateModelById,
      remoteListingIdByLocalId,
      categoryLocalIdByIdMaster,
      objectById,
      objectsByListingId,
    };
  }, [referencedObjects, stateModelById, remoteListingIdByLocalId]);
}
