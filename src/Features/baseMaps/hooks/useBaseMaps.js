import db from "App/db/db";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import BaseMap from "../js/BaseMap";

export default function useBaseMaps(options) {
  // options

  const _filterByProjectId = options?.filterByProject;
  const filterByListingId = options?.filterByListingId;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector(
    (s) => s.entities.entitiesTableUpdatedAt?.["baseMaps"]
  );

  // helpers

  const filterByProjectId = _filterByProjectId ?? projectId;

  const hasNullFilterByProjectId =
    options != null && // options exists (not null/undefined)
    Object.prototype.hasOwnProperty.call(options, "filterByProjectId") && // prop is present
    options.filterByProjectId === null; // and its value is exactly null

  // main

  const baseMaps = useLiveQuery(async () => {
    let records;
    if (hasNullFilterByProjectId) {
      return null;
    }
    if (filterByProjectId) {
      records = await db.baseMaps
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      records = await db.baseMaps.toArray();
    }

    // filter by listing
    if (filterByListingId) {
      records = records.filter(
        (record) => record.listingId === filterByListingId
      );
    }

    const _baseMaps = await Promise.all(
      records.map(async (record) => await BaseMap.createFromRecord(record))
    );
    return _baseMaps;
  }, [projectId, baseMapsUpdatedAt, filterByListingId, filterByProjectId]);

  // return

  return { value: baseMaps };
}
