import Marker from "../js/Marker";

import db from "App/db/db";

import store from "App/store";
import { triggerMarkersUpdate } from "../markersSlice";

export default async function createMarkerService({
  x,
  y,
  baseMapId,
  iconColor,
  iconIndex,
}) {
  const marker = await Marker.create({ x, y, baseMapId, iconColor, iconIndex });

  const record = marker.toDb();

  await db.markers.add(record);

  store.dispatch(triggerMarkersUpdate());
}
