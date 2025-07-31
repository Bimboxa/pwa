import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

export default function useMarkers(options) {
  // data

  const loadedMainBaseMapId = useSelector(
    (s) => s.mapEditor.loadedMainBaseMapId
  );

  const markersUpdatedAt = useSelector((s) => s.markers.markersUpdatedAt);

  // helpers

  const filterByBaseMapId = options?.filterByBaseMapId;

  return useLiveQuery(async () => {
    let markers;
    if (filterByBaseMapId) {
      markers = db.markers.toArray();
    } else {
      markers = db.markers.toArray();
    }
    return markers;
  }, [markersUpdatedAt]);
}
