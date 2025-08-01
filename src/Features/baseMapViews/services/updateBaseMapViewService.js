import db from "App/db/db";

export default async function updateBaseMapViewService({ updates }) {
  const id = updates.id;

  const _updates = { ...updates };

  if (updates.baseMap) _updates.baseMap = updates.baseMap.toDb().baseMapRecord;

  return await db.baseMapViews.update(id, _updates);
}
