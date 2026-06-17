import db from "App/db/db";

// Returns an `updateDimension3d(id, changes)` function. Partial update; the db
// audit hook stamps updatedAt and the useLiveQuery consumers (ThreedDimensions,
// useSelectedDimension3d) re-run to reflect the change.
export default function useUpdateDimension3d() {
  return async (dimensionId, changes) => {
    if (!dimensionId || !changes) return;
    await db.dimensions3d.update(dimensionId, changes);
  };
}
