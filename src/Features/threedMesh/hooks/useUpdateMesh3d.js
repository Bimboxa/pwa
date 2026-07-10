import db from "App/db/db";

// Returns an `updateMesh3d(id, changes)` function. Partial update; the audit
// hook stamps updatedAt and the useLiveQuery consumers (ThreedMeshes,
// useSelectedMeshes3d) re-run to reflect the change.
export default function useUpdateMesh3d() {
  return async (mesh3dId, changes) => {
    if (!mesh3dId || !changes) return;
    await db.meshes3d.update(mesh3dId, changes);
  };
}
