import db from "App/db/db";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import BaseMap from "../js/BaseMap";

export default function useBaseMaps(options) {
  // options

  const _filterByProjectId = options?.filterByProject;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector(
    (s) => s.entities.entitiesTableUpdatedAt["baseMaps"]
  );

  // helpers

  const filterByProjectId = _filterByProjectId ?? projectId;

  // main

  const baseMaps = useLiveQuery(async () => {
    let records;
    if (filterByProjectId) {
      records = await db.baseMaps
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      records = await db.baseMaps.toArray();
    }

    // filter by listing
    records = records.filter((record) => record.listingId);

    const _baseMaps = await Promise.all(
      records.map(async (record) => await BaseMap.createFromRecord(record))
    );
    return _baseMaps;
  }, [projectId, baseMapsUpdatedAt]);

  console.log("debug_0915 baseMaps", baseMaps);

  // return

  return { value: baseMaps };
}
