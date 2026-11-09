import { computeArcSagittaEdit } from "Features/geometry/utils/arcChordSagitta";

import applyPointsMovesService from "./applyPointsMovesService";

// Apply a typed sagitta (« flèche ») on an S-C-S arc of a POLYLINE / POLYGON /
// STRIP contour: only the circle-typed control point moves, the chord stays.
//
// `annotation` is the RESOLVED annotation (pixel points carrying their
// db.points id); `arcStartIndex` is the index of P0 (first square of the
// triplet). Write-back shared with the vertex drags via applyPointsMovesService.
export default async function applyArcSagittaEditService({
  annotation,
  closed = false,
  arcStartIndex,
  targetMeters,
  meterByPx,
  dispatch,
}) {
  const points = annotation?.points;
  const n = points?.length ?? 0;
  if (n < 3) return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(meterByPx) || meterByPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(targetMeters) || targetMeters <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (
    !Number.isInteger(arcStartIndex) ||
    arcStartIndex < 0 ||
    arcStartIndex >= n ||
    (!closed && arcStartIndex > n - 3)
  )
    return { ok: false, reason: "INVALID_INPUT" };

  const p0 = points[arcStartIndex];
  const p1 = points[(arcStartIndex + 1) % n];
  const p2 = points[(arcStartIndex + 2) % n];
  if (!p1?.id) return { ok: false, reason: "INVALID_INPUT" };

  const result = computeArcSagittaEdit({
    p0,
    p1,
    p2,
    targetPx: targetMeters / meterByPx,
  });
  if (!result.ok) return result;

  return applyPointsMovesService({
    annotation,
    moves: [{ pointId: p1.id, x: result.point.x, y: result.point.y }],
    meterByPx,
    dispatch,
  });
}
