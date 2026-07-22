import db from "App/db/db";

// True as soon as the label card or the leader target was hand-placed: both
// offsets are stored relative to the maille anchor, `null` meaning "on the
// anchor" (see getMesh3dLabelAnchor).
export function hasMesh3dLabelOffset(mesh3d) {
  return Boolean(mesh3d?.labelOffset || mesh3d?.labelTargetOffset);
}

/**
 * Returns a `resetLabelPositions(meshes3d)` function: bulk version of the
 * per-maille "Recentrer l'étiquette" of ToolbarEditMesh3d. Clearing both
 * offsets is enough to put every card back ON its maille — the anchor is
 * recomputed at render time and already lands on the material (holes, L / U
 * shapes and curved shells included).
 *
 * @returns {number} how many mailles were reset.
 */
export default function useResetMeshes3dLabelPositions() {
  return async (meshes3d) => {
    const ids = (meshes3d || [])
      .filter(hasMesh3dLabelOffset)
      .map((mesh3d) => mesh3d.id);
    if (!ids.length) return 0;

    await db.transaction("rw", db.meshes3d, async () => {
      await db.meshes3d.bulkUpdate(
        ids.map((key) => ({
          key,
          changes: { labelOffset: null, labelTargetOffset: null },
        }))
      );
    });
    return ids.length;
  };
}
