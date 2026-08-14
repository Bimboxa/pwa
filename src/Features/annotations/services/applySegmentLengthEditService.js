import computeSegmentLengthEdit from "../utils/computeSegmentLengthEdit";
import applyPointsMovesService from "./applyPointsMovesService";

// Apply a typed segment length on a POLYLINE / POLYGON / STRIP contour.
//
// `annotation` is the RESOLVED annotation (pixel points, each carrying its
// db.points id). The geometry is decided by computeSegmentLengthEdit; the
// write-back (normalized db.points rows, rotation clearing, glued-openings
// reflow) is shared with the EDIT-mode drags via applyPointsMovesService.
export default async function applySegmentLengthEditService({
  annotation,
  closed = false,
  segmentIndex,
  targetMeters,
  meterByPx,
  lockedSegmentIndexes = new Set(),
  lockedPointIndexes = new Set(),
  anglesLocked = false,
  dispatch,
}) {
  const points = annotation?.points;
  if (!points?.length) return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(meterByPx) || meterByPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(targetMeters) || targetMeters <= 0)
    return { ok: false, reason: "INVALID_INPUT" };

  const result = computeSegmentLengthEdit({
    points,
    closed,
    segmentIndex,
    targetPx: targetMeters / meterByPx,
    lockedSegmentIndexes,
    lockedPointIndexes,
    anglesLocked,
  });
  if (!result.ok) return result;

  const moves = result.moves
    .map(({ index, x, y }) => {
      const pointId = points[index]?.id;
      if (!pointId) return null;
      return { pointId, x, y };
    })
    .filter(Boolean);

  return applyPointsMovesService({ annotation, moves, meterByPx, dispatch });
}
