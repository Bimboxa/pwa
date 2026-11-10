// Geometry of a block INSTANCE on its host base map (pixel frame, y down).
//
// An instance stores a zero-size anchor bbox (its center = the insertion
// point), a `rotation` in degrees (clockwise on screen, about the anchor) and
// no scale: the block is drawn at real size, so 1 m of the block frame is
// 1 / hostMeterByPx host pixels.
//
// Pure: node-testable.

// Insertion point of an instance, from its resolved (pixel) bbox.
export function getBlockInstanceAnchorPx(annotation) {
  const bbox = annotation?.bbox;
  if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
  return {
    x: bbox.x + (Number(bbox.width) || 0) / 2,
    y: bbox.y + (Number(bbox.height) || 0) / 2,
  };
}

// Block frame (meters) → host pixels.
export function blockPointToHostPx({ pointM, anchorPx, rotationDeg, hostMeterByPx }) {
  const rad = ((Number(rotationDeg) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = pointM.x / hostMeterByPx;
  const y = pointM.y / hostMeterByPx;
  return {
    x: anchorPx.x + x * cos - y * sin,
    y: anchorPx.y + x * sin + y * cos,
  };
}

// Host pixels → block frame (meters). Inverse of blockPointToHostPx.
export function hostPxToBlockPoint({ pointPx, anchorPx, rotationDeg, hostMeterByPx }) {
  const rad = ((Number(rotationDeg) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pointPx.x - anchorPx.x;
  const dy = pointPx.y - anchorPx.y;
  return {
    x: (dx * cos + dy * sin) * hostMeterByPx,
    y: (-dx * sin + dy * cos) * hostMeterByPx,
  };
}

// The 4 corners of the block bounds, in host pixels (turned with the instance).
export function getBlockInstanceCornersPx({
  boundsM,
  anchorPx,
  rotationDeg,
  hostMeterByPx,
}) {
  if (!boundsM || !anchorPx || !(hostMeterByPx > 0)) return [];
  const { minX, minY, maxX, maxY } = boundsM;
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ].map((pointM) =>
    blockPointToHostPx({ pointM, anchorPx, rotationDeg, hostMeterByPx })
  );
}

// Axis-aligned bounding box of an instance, in host pixels: {x, y, width,
// height}, or null when the block bounds / the scale are unknown.
export function getBlockInstanceBoundsPx(args) {
  const corners = getBlockInstanceCornersPx(args);
  if (corners.length === 0) return null;
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// SVG transform of the <defs> definition group: member pixels (origin base
// map) → block frame in meters, insertion point at (0, 0).
export function getBlockDefinitionTransform({ originPx, meterByPx }) {
  return `scale(${meterByPx}) translate(${-originPx.x} ${-originPx.y})`;
}

// SVG transform of one instance: block frame (meters) → host pixels.
export function getBlockInstanceTransform({ anchorPx, rotationDeg, hostMeterByPx }) {
  return `translate(${anchorPx.x} ${anchorPx.y}) rotate(${
    Number(rotationDeg) || 0
  }) scale(${1 / hostMeterByPx})`;
}
