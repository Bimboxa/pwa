import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Whether the main base map of the 2D editors is an orthomosaic
// (baseMap.isOrthophoto). Light read of the raw row — no image hydration:
// this gates the bottom bar toggle and the Orthophotos tool of the right
// band, both mounted in every module.
export default function useIsMainBaseMapOrthophoto() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  return (
    useLiveQuery(async () => {
      if (!baseMapId) return false;
      const row = await db.baseMaps.get(baseMapId);
      return Boolean(row && !row.deletedAt && row.isOrthophoto);
    }, [baseMapId]) ?? false
  );
}
