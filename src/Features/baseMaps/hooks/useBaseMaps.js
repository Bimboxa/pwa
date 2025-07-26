import db from "App/db/db";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import BaseMap from "../js/BaseMap";

export default function useBaseMaps(options) {
  // options

  const _filterByProjectId = options?.filterByProject;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);

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
    return await Promise.all(
      records.map(async (record) => await BaseMap.createFromRecord(record))
    );
  }, [projectId, baseMapsUpdatedAt]);

  // return

  return { value: baseMaps };
}
