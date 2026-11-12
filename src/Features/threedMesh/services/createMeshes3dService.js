import db from "App/db/db";

import buildMesh3dRecord from "../utils/buildMesh3dRecord";

// Creates several mailles in ONE transaction and ONE bulkAdd, so the
// meshes3d live queries (and the 3D scene rebuild) fire once for the whole
// batch instead of once per maille.
//
// `items` are createMesh3dService-like payloads ({ faces, shell, baseColor,
// sourceInfo, ... }). Records are built in order, each one against the
// scope's rows PLUS the records built before it, so numbers are consecutive
// and the fill shades contrast with the adjacent mailles of the same batch.
//
// Returns the created records (items without geometry are skipped).
export default async function createMeshes3dService({
  projectId,
  scopeId,
  items,
}) {
  if (!projectId || !scopeId || !items?.length) return [];

  return db.transaction("rw", db.meshes3d, async () => {
    const rows = await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();

    const records = [];
    for (const item of items) {
      const record = buildMesh3dRecord({ ...item, projectId, scopeId }, rows);
      if (!record) continue;
      records.push(record);
      rows.push(record);
    }

    if (records.length) await db.meshes3d.bulkAdd(records);
    return records;
  });
}
