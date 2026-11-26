// The 4 corners of a RECTANGLE annotation (bbox + rotation), rotation applied.
//
// `bbox` and the result share the same space (pixels for a resolved
// annotation). `rotation` is in degrees around the bbox centre, with the SVG
// convention of NodeRectangleStatic: positive = clockwise on screen (y down).
// Order: NW, NE, SE, SW of the unrotated bbox (a closed ring when looped).

export function rotatePointAround(point, center, rotationDeg) {
  const rad = ((rotationDeg || 0) * Math.PI) / 180;
  if (!rad) return { x: point.x, y: point.y };
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getRectangleCenter(bbox) {
  return {
    x: (bbox?.x ?? 0) + (bbox?.width ?? 0) / 2,
    y: (bbox?.y ?? 0) + (bbox?.height ?? 0) / 2,
  };
}

export default function getRectangleCorners({ bbox, rotation } = {}) {
  if (
    !bbox ||
    !Number.isFinite(bbox.x) ||
    !Number.isFinite(bbox.y) ||
    !Number.isFinite(bbox.width) ||
    !Number.isFinite(bbox.height)
  ) {
    return null;
  }
  const { x, y, width, height } = bbox;
  const center = getRectangleCenter(bbox);
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ].map((corner) => rotatePointAround(corner, center, rotation));
}
