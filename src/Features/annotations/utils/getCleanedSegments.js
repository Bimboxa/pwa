// getCleanedSegments
//
// Pure helper around `cleanSegments` that returns a cleaned LIST of
// 2-point segments instead of the algorithm's raw `{ updates, deleteIds }`.
//
// Use this when you have an in-memory array of segments (e.g. detected
// segments from smart-detect, before they're persisted as annotations) and
// want a one-shot "list in → cleaned list out" API. The DB-aware hook
// `useCleanSegments` keeps using `cleanSegments` directly because it needs
// the raw updates/deletes shape for persistence (db.points refs, virtual
// segment routing, etc.).
//
// Input segment shape (per cleanSegments):
//   { id, points: [{id, x, y, type?}, {id, x, y, type?}],
//     strokeWidth, strokeWidthUnit }
//
// Output: array of segments with the same shape — deleted ones are
// dropped, updated ones get their `points` swapped (other fields kept).

import cleanSegments from "./cleanSegments";

export default function getCleanedSegments({ segments, meterByPx }) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const { updates, deleteIds } = cleanSegments({ segments, meterByPx });

  const updateMap = new Map(updates.map((u) => [u.id, u.points]));
  const deleteSet = new Set(deleteIds);

  const cleaned = [];
  for (const s of segments) {
    if (deleteSet.has(s.id)) continue;
    if (updateMap.has(s.id)) {
      cleaned.push({ ...s, points: updateMap.get(s.id) });
    } else {
      cleaned.push(s);
    }
  }
  return cleaned;
}
