import { useLiveQuery } from "dexie-react-hooks";

import BaseMapView from "../js/BaseMapView";

import db from "App/db/db";

export default function useFirstBaseMapView({ baseMapId }) {
  return useLiveQuery(async () => {
    if (!baseMapId) return null;
    const records = await db.baseMapViews
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();

    const record0 = records.length > 0 ? records[0] : null;

    return BaseMapView.createFromRecord(record0);
  });
}
