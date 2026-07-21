// Resolves a profileLine ref array [{pointId, type, height?}] to pixel
// coordinates using the same db.points index as resolvePoints. Same contract
// as resolveGuideLine, plus the inline per-vertex `height` (meters, offsetTop
// semantics) passes through — resolveGuideLine deliberately drops extra ref
// fields, so profile lines need their own resolver.
export default function resolveProfileLine({
  profileLine,
  pointsIndex,
  imageSize,
}) {
  if (!Array.isArray(profileLine) || !pointsIndex || !imageSize) {
    return profileLine;
  }
  return profileLine
    .map((ref) => {
      const p = pointsIndex[ref?.pointId];
      if (!p) return null;
      return {
        pointId: ref.pointId,
        id: ref.pointId,
        type: ref?.type ?? "square",
        ...(typeof ref?.height === "number" ? { height: ref.height } : {}),
        x: p.x * imageSize.width,
        y: p.y * imageSize.height,
      };
    })
    .filter(Boolean);
}
