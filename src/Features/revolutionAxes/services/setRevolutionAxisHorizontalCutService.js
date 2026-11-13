import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import getRevolutionAxisHorizontalCutZ from "../utils/getRevolutionAxisHorizontalCutZ";

// Writes the horizontal 3D cut of a revolution axis: `horizontalCutIn3d`
// (on / off) and / or `horizontalCutZ` (metres above the base of the axis).
//
// Like the "Demi-vue 3D" flag it is a VIEW setting stored on the axis, not
// authored content: system write (anyone may switch it, read-only scope
// included) and no undo step. Switching it on for the first time stores the
// default altitude (mid-height of the axis) so the handle has a value to
// start from.
export default async function setRevolutionAxisHorizontalCutService(
  axisId,
  { enabled, z } = {}
) {
  if (!axisId) return;
  const updates = {};
  if (enabled !== undefined) updates.horizontalCutIn3d = Boolean(enabled);
  if (Number.isFinite(z)) updates.horizontalCutZ = Math.max(0, z);
  if (updates.horizontalCutIn3d && updates.horizontalCutZ === undefined) {
    const axis = await db.annotations.get(axisId);
    if (axis && !Number.isFinite(axis.horizontalCutZ))
      updates.horizontalCutZ = getRevolutionAxisHorizontalCutZ(axis);
  }
  if (!Object.keys(updates).length) return;
  await withSystemWrite(() =>
    withoutUndo(() => db.annotations.update(axisId, updates))
  );
}
