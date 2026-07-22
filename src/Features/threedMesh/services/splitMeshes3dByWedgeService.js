import db from "App/db/db";

import splitMesh3dByWedgeService from "./splitMesh3dByWedgeService";

// Batch angular cut: one wedge, several mailles ("Multi-mailles" toggle).
// Same single-transaction rule as splitMeshes3dByNearPlaneService.
export default async function splitMeshes3dByWedgeService(entries) {
  const list = (entries || []).filter(
    (entry) => entry?.inside && entry?.outside
  );
  if (!list.length) return null;

  return db.transaction("rw", db.meshes3d, async () => {
    const results = [];
    for (const entry of list) {
      results.push(await splitMesh3dByWedgeService(entry));
    }
    return results;
  });
}
