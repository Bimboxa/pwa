import db from "App/db/db";

import BaseMap from "Features/baseMaps/js/BaseMap";

// BaseMap object (image size, scale, 3D placement accessors) of a base map
// id, outside React. Same construction as useBaseMap. Null when missing.
export default async function getBaseMapObjectAsync(baseMapId) {
  if (!baseMapId) return null;
  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt) return null;
  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  ).filter((v) => !v.deletedAt);
  return BaseMap.createFromRecord(record, versions);
}
