import db from "App/db/db";
import BaseMap from "Features/baseMaps/js/BaseMap";

// Dexie base map records are plain objects; the section-mark solvers need the
// BaseMap getters (getImageSize / getMeterByPx resolve the versioned
// reference frame).

const liveVersions = (versions) => (versions ?? []).filter((v) => !v.deletedAt);

// SYNCHRONOUS, image-less BaseMap: enough for the geometry (reference size,
// scale, 3D pose), which only reads record-level fields. For list / panel
// readers that go through many base maps: no file read, no image decoding —
// and nothing to await inside a Dexie liveQuery.
export function createGeometryBaseMap(record, versions) {
  if (!record) return null;
  return new BaseMap({ ...record, versions: liveVersions(versions) });
}

// Fully hydrated BaseMap (images loaded and cached, like the editors).
// ASYNC: BaseMap.createFromRecord returns a promise — a pending promise is
// truthy and has no getter, so a missing `await` silently reads as "no
// scale / no size".
export default async function getHydratedBaseMap(baseMapId) {
  if (!baseMapId) return null;
  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(record.id)
    .toArray();
  return await BaseMap.createFromRecord(record, liveVersions(versions));
}
