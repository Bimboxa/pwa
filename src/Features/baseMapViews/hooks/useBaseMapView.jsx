import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useBaseMapView({ id }) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const baseMapView = await db.baseMapViews.get(id);
    return baseMapView;
  }, [id]);
}
