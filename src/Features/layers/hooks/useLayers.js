import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

export default function useLayers({ filterByBaseMapId } = {}) {
  const layersUpdatedAt = useSelector((s) => s.layers.layersUpdatedAt);

  const layers = useLiveQuery(
    async () => {
      if (!filterByBaseMapId) return [];
      const records = await db.layers
        .where("baseMapId")
        .equals(filterByBaseMapId)
        .toArray();
      return records
        .filter((r) => !r.deletedAt)
        .sort((a, b) => {
          if (a.orderIndex != null && b.orderIndex != null) {
            return a.orderIndex.localeCompare(b.orderIndex);
          }
          if (a.orderIndex != null) return -1;
          if (b.orderIndex != null) return 1;
          return 0;
        });
    },
    [filterByBaseMapId, layersUpdatedAt]
  );

  return layers;
}
