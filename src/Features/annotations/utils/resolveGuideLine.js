// Resolves a guideLine ref array [{pointId, type}] to pixel coordinates using
// the same db.points index as resolvePoints. Returns [{pointId, id, type, x,
// y}] (pixels) or the input unchanged when it cannot be resolved. `id` is
// mirrored from `pointId` so arc helpers (arcSampling) that key on `id`/`type`
// work unchanged.
export default function resolveGuideLine({
  guideLine,
  pointsIndex,
  imageSize,
}) {
  if (!Array.isArray(guideLine) || !pointsIndex || !imageSize) {
    return guideLine;
  }
  return guideLine
    .map((ref) => {
      const p = pointsIndex[ref?.pointId];
      if (!p) return null;
      return {
        pointId: ref.pointId,
        id: ref.pointId,
        type: ref?.type ?? "square",
        x: p.x * imageSize.width,
        y: p.y * imageSize.height,
      };
    })
    .filter(Boolean);
}
