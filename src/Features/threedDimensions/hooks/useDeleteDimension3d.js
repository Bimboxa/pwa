import db from "App/db/db";

// Returns a `deleteDimension3d(id)` function. The soft-delete middleware turns
// db.delete into a `deletedAt` stamp; the useLiveQuery in ThreedDimensions then
// re-runs and removes the sprite from the scene.
export default function useDeleteDimension3d() {
  return async (dimensionId) => {
    if (!dimensionId) return;
    await db.dimensions3d.delete(dimensionId);
  };
}
