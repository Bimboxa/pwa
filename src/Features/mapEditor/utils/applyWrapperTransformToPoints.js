/**
 * Compute new point positions after a wrapper transform (move, resize, rotate).
 * Points are in pixel coordinates. Returns a Map of pointId → { x, y }.
 *
 * For MOVE: translates all points by deltaPos.
 * For RESIZE: scales points relative to the opposite corner of the resize handle.
 * For ROTATE: rotates all points around the wrapper bbox center by deltaPos.x degrees.
 *
 * @param {Object} params
 * @param {Array} params.annotations - Annotations with resolved .points [{id, x, y, ...}]
 * @param {{ x: number, y: number, width: number, height: number }} params.wrapperBbox - Original wrapper bbox (pixel coords)
 * @param {{ x: number, y: number }} params.deltaPos - Delta in pixels (for ROTATE: x = angle in degrees)
 * @param {string|null} params.partType - null for move, "RESIZE_SE", "RESIZE_NW", "ROTATE", etc.
 * @returns {Map<string, { x: number, y: number }>} pointId → new pixel position
 */
export default function applyWrapperTransformToPoints({
  annotations,
  wrapperBbox,
  deltaPos,
  partType,
}) {
  const pointUpdates = new Map();

  if (!annotations?.length || !wrapperBbox || !deltaPos) return pointUpdates;

  // Collect all unique points from all annotations
  const allPoints = new Map();
  for (const ann of annotations) {
    for (const pt of ann.points ?? []) {
      if (pt.x != null && pt.y != null) {
        allPoints.set(pt.id, { x: pt.x, y: pt.y });
      }
    }
    for (const cut of ann.cuts ?? []) {
      for (const pt of cut.points ?? []) {
        if (pt.x != null && pt.y != null) {
          allPoints.set(pt.id, { x: pt.x, y: pt.y });
        }
      }
    }
  }

  // MOVE
  if (!partType || partType === "MOVE") {
    for (const [id, pt] of allPoints) {
      pointUpdates.set(id, {
        x: pt.x + deltaPos.x,
        y: pt.y + deltaPos.y,
      });
    }
    return pointUpdates;
  }

  // ROTATE
  if (partType === "ROTATE") {
    const { x: bx, y: by, width: bw, height: bh } = wrapperBbox;
    const centerX = bx + bw / 2;
    const centerY = by + bh / 2;
    const angleDeg = deltaPos.x;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    for (const [id, pt] of allPoints) {
      const dx = pt.x - centerX;
      const dy = pt.y - centerY;
      pointUpdates.set(id, {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      });
    }
    return pointUpdates;
  }

  // RESIZE
  if (partType.startsWith("RESIZE_")) {
    const handle = partType.replace("RESIZE_", "");
    const { x: bx, y: by, width: bw, height: bh } = wrapperBbox;

    // Determine the anchor (fixed corner, opposite to the handle being dragged)
    let anchorX, anchorY;
    if (handle === "SE") { anchorX = bx; anchorY = by; }
    else if (handle === "SW") { anchorX = bx + bw; anchorY = by; }
    else if (handle === "NE") { anchorX = bx; anchorY = by + bh; }
    else if (handle === "NW") { anchorX = bx + bw; anchorY = by + bh; }
    else return pointUpdates;

    // Compute new dimensions
    let newW = bw;
    let newH = bh;

    if (handle === "SE") { newW = bw + deltaPos.x; newH = bh + deltaPos.y; }
    else if (handle === "SW") { newW = bw - deltaPos.x; newH = bh + deltaPos.y; }
    else if (handle === "NE") { newW = bw + deltaPos.x; newH = bh - deltaPos.y; }
    else if (handle === "NW") { newW = bw - deltaPos.x; newH = bh - deltaPos.y; }

    // Minimum size guard
    if (Math.abs(newW) < 20) newW = 20 * Math.sign(newW || 1);
    if (Math.abs(newH) < 20) newH = 20 * Math.sign(newH || 1);

    // Scale factors
    const scaleX = bw > 0 ? newW / bw : 1;
    const scaleY = bh > 0 ? newH / bh : 1;

    for (const [id, pt] of allPoints) {
      pointUpdates.set(id, {
        x: anchorX + (pt.x - anchorX) * scaleX,
        y: anchorY + (pt.y - anchorY) * scaleY,
      });
    }
    return pointUpdates;
  }

  return pointUpdates;
}
