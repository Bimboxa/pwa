import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import demoMarkers from "../data/demoMarkers";

import db from "App/db/db";

export default function useMarkers(options) {
  // data

  const markersUpdatedAt = useSelector((s) => s.markers.markersUpdatedAt);

  // options

  const filterByBaseMapId = options?.filterByBaseMapId;
  const addDemoMarkers = options?.addDemoMarkers;

  return useLiveQuery(async () => {
    let markers;
    if (filterByBaseMapId) {
      markers = await db.markers.toArray();
    } else {
      markers = await db.markers.toArray();
    }

    // demo markers
    if (addDemoMarkers) markers = [...markers, ...demoMarkers];
    return markers;
  }, [markersUpdatedAt]);
}
