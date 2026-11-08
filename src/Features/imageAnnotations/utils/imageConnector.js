// Both functions use their caller's coordinate space (normalized or pixels).
export function getImageAnchorPoint(annotation) {
  if (annotation?.targetPoint) return { ...annotation.targetPoint };
  const b = annotation?.bbox ?? {};
  return {
    x: (b.x ?? 0) + (b.width ?? 0) / 2,
    y: (b.y ?? 0) + (b.height ?? 0) / 2,
  };
}

// Intersect the leader with the rotated image border, never across the photo.
export function getImageConnectorGeometry(annotation) {
  const b = annotation?.bbox;
  if (!b || !(b.width > 0 && b.height > 0)) return null;
  const target = getImageAnchorPoint(annotation);
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const angle = ((annotation.rotation || 0) * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const dx = target.x - center.x,
    dy = target.y - center.y;
  const x = dx * c + dy * s,
    y = -dx * s + dy * c;
  const ratio = Math.max(
    Math.abs(x) / (b.width / 2),
    Math.abs(y) / (b.height / 2)
  );
  if (ratio <= 1) return { target, end: target, inside: true };
  return {
    target,
    end: { x: center.x + dx / ratio, y: center.y + dy / ratio },
    inside: false,
  };
}

export function getImageCardLift(annotation) {
  if (Number.isFinite(annotation.imageLift3d)) return annotation.imageLift3d;
  return annotation.imageOrientation3d === "HORIZONTAL" ? 0 : 1;
}

// Stored row + basemap-local metre delta → stored row patch. The target
// stays fixed when the card moves, including the first move of legacy images.
export function getImageCardMoveUpdates(
  annotation,
  delta,
  imageSize,
  meterByPx,
  target = false
) {
  if (!(imageSize?.width > 0 && imageSize?.height > 0 && meterByPx > 0))
    return null;
  const dx = delta.x / meterByPx / imageSize.width;
  const dy = -delta.y / meterByPx / imageSize.height;
  const anchor = getImageAnchorPoint(annotation);
  if (target) return { targetPoint: { x: anchor.x + dx, y: anchor.y + dy } };
  if (!annotation?.bbox) return null;
  return {
    bbox: {
      ...annotation.bbox,
      x: annotation.bbox.x + dx,
      y: annotation.bbox.y + dy,
    },
    targetPoint: anchor,
    imageLift3d: getImageCardLift(annotation) + delta.z,
  };
}
