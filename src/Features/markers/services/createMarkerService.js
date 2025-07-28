import Marker from "../js/Marker";

import db from "App/db/db";

export default async function createMarkerService({ x, y, baseMapId }) {
  const marker = await Marker.create({ x, y, baseMapId });

  const record = marker.db();

  await db.markers.add(record);
}
