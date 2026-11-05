import db from "App/db/db";
import BaseMap from "Features/baseMaps/js/BaseMap";

// Dexie base map records are plain objects; the section-mark solvers need the
// BaseMap getters (getImageSize / getMeterByPx resolve the versioned
// reference frame).
export function hydrateBaseMapRecord(record, versions) {
  if (!record) return null;
  return BaseMap.createFromRecord(
    record,
    (versions ?? []).filter((v) => !v.deletedAt)
  );
}

export default async function getHydratedBaseMap(baseMapId) {
  if (!baseMapId) return null;
  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(record.id)
    .toArray();
  return hydrateBaseMapRecord(record, versions);
}
