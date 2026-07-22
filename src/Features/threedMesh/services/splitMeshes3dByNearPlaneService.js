import db from "App/db/db";

import splitMesh3dByNearPlaneService from "./splitMesh3dByNearPlaneService";

// Batch axis cut: one plane, several mailles ("Multi-mailles" toggle). A
// single transaction so a trait across a run of mailles either lands whole or
// not at all — Dexie reuses the parent transaction for the per-maille calls,
// which share its scope and mode.
export default async function splitMeshes3dByNearPlaneService(entries) {
  const list = (entries || []).filter((entry) => entry?.pieces?.length);
  if (!list.length) return null;

  return db.transaction("rw", db.meshes3d, async () => {
    const results = [];
    for (const entry of list) {
      results.push(await splitMesh3dByNearPlaneService(entry));
    }
    return results;
  });
}
