import { useLiveQuery } from "dexie-react-hooks";

export default function useMarkers(options) {
  // data

  const loadedMainBaseMapId = useSelector(
    (s) => s.mapEditor.loadedMainBaseMapId
  );

  // helpers

  const filterByBaseMapId = options?.filterByBaseMapId;

  return useLiveQuery(async () => {
    let markers;
    if (filterByBaseMapId) {
      markers = db.markers.toArray();
    } else {
      markers = db.markers.toArray();
    }
  });
}
