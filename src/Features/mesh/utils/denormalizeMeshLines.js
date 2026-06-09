// Convert persisted mesh cut lines (stored on the parent annotation) back into
// the editor's world space, inverse of normalizeMeshLine in saveMeshService.
//   POLYGON  → [0..1] baseMap coords      → pixel coords (× imageSize)
//   POLYLINE → elevation param { u, z }   → elevation world (developed X, -z/meterByPx)
export default function denormalizeMeshLines(
  meshLines,
  { mode, imageSize, developedRange, meterByPx }
) {
  if (!Array.isArray(meshLines)) return [];

  const denorm = (p) => {
    if (mode === "POLYGON") {
      return { x: (p.x ?? 0) * imageSize.width, y: (p.y ?? 0) * imageSize.height };
    }
    const span = (developedRange?.xMax ?? 1) - (developedRange?.xMin ?? 0) || 1;
    return {
      x: (developedRange?.xMin ?? 0) + (p.u ?? 0) * span,
      y: -(p.z ?? 0) / meterByPx,
    };
  };

  return meshLines.map((l) => ({
    id: l.id,
    orientation: l.orientation,
    p1: denorm(l.p1),
    p2: denorm(l.p2),
  }));
}
