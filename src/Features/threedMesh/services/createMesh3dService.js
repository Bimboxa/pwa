import db from "App/db/db";

import buildMesh3dRecord from "../utils/buildMesh3dRecord";

// Creates ONE maille. The record (number, colors, surface) is built inside
// the transaction by buildMesh3dRecord against all the rows of the scope.
// To create several mailles at once, use createMeshes3dService (one
// transaction, one bulkAdd) instead of looping on this service.
export default async function createMesh3dService({
  projectId,
  scopeId,
  faces = null,
  shell = null,
  // Cut segments the maille is already opened along — see seamUtils.
  seams = [],
  baseColor = null,
  color = null,
  edgeColor = null,
  label = null,
  sourceInfo = null,
}) {
  if (!projectId || !scopeId) return null;
  // A maille is either planar (polygon faces) or curved (triangulated shell).
  if (!faces?.length && !shell?.positions?.length) return null;

  return db.transaction("rw", db.meshes3d, async () => {
    const rows = await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    const record = buildMesh3dRecord(
      {
        projectId,
        scopeId,
        faces,
        shell,
        seams,
        baseColor,
        color,
        edgeColor,
        label,
        sourceInfo,
      },
      rows
    );
    await db.meshes3d.add(record);
    return record;
  });
}
