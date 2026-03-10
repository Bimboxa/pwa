import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";

import BaseMap from "../js/BaseMap";

export default function useBaseMap(options) {
  // options

  const id = options?.id;

  return useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.baseMaps.get(id);
    if (!record) return null;
    const versions = (
      await db.baseMapVersions.where("baseMapId").equals(id).toArray()
    ).filter((v) => !v.deletedAt);
    return await BaseMap.createFromRecord(record, versions);
  }, [id]);
}
