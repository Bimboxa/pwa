import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import BaseMapView from "../js/BaseMapView";

export default function useBaseMapView({ id }) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.baseMapViews.get(id);
    console.log("record", record);
    return record ? await BaseMapView.createFromRecord(record) : null;
  }, [id]);
}
