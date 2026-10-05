import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

// Writes the "Demi-vue 3D" flag of a revolution axis (halfViewIn3d).
//
// It is a VIEW setting stored on the axis, not authored content: anyone may
// switch it, whoever created the axis and even in a read-only scope. Hence
// the system write (bypasses the ownership and read-only scope guards, and
// leaves the axis's `updatedByUserIdMaster` alone) and no undo step.
export default async function setRevolutionAxisHalfViewService(
  axisId,
  halfViewIn3d
) {
  if (!axisId) return;
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.annotations.update(axisId, { halfViewIn3d: Boolean(halfViewIn3d) })
    )
  );
}
