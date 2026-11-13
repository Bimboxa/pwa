// Both functions use their caller's coordinate space (normalized or pixels).
export function getImageAnchorPoint(annotation) {
  if (annotation?.targetPoint) return { ...annotation.targetPoint };
  const b = annotation?.bbox ?? {};
  return {
    x: (b.x ?? 0) + (b.width ?? 0) / 2,
    y: (b.y ?? 0) + (b.height ?? 0) / 2,
  };
}

// Detached: the photo was dragged away from its badge (`hasConnector`), its
// stored bbox is authoritative and a link line joins the two. Otherwise the
// photo is pinned on its anchor. « Objet 2D » symbols are never pinned.
export function isImageDetached(annotation) {
  return Boolean(annotation?.hasConnector) || Boolean(annotation?.isObject2D);
}

// The bbox that puts the VISUAL top-left of the photo on the anchor: the
// top-left corner of the axis-aligned box around the rotated photo (the
// photo's own corner for a 0 / 90 / 180 / 270° rotation). Pixel space by
// default; pass `imageSize` for a normalized row (a rotation is only valid
// in pixels) — the result is then normalized as well.
export function getImagePinnedBbox(annotation, imageSize) {
  const b = annotation?.bbox;
  if (!b) return b;
  const sx = imageSize?.width > 0 ? imageSize.width : 1;
  const sy = imageSize?.height > 0 ? imageSize.height : 1;
  const anchor = getImageAnchorPoint(annotation);
  const w = (b.width ?? 0) * sx,
    h = (b.height ?? 0) * sy;
  const angle = ((annotation.rotation || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const centerX = anchor.x * sx + (w * c + h * s) / 2;
  const centerY = anchor.y * sy + (w * s + h * c) / 2;
  return { ...b, x: (centerX - w / 2) / sx, y: (centerY - h / 2) / sy };
}

// Inverse of getImagePinnedBbox: the anchor a photo placed at `bbox` is
// pinned on (its visual top-left corner). Same space rule.
export function getImagePinnedAnchor(annotation, imageSize) {
  const b = annotation?.bbox ?? {};
  const sx = imageSize?.width > 0 ? imageSize.width : 1;
  const sy = imageSize?.height > 0 ? imageSize.height : 1;
  const w = (b.width ?? 0) * sx,
    h = (b.height ?? 0) * sy;
  const angle = ((annotation?.rotation || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  return {
    x: ((b.x ?? 0) * sx + w / 2 - (w * c + h * s) / 2) / sx,
    y: ((b.y ?? 0) * sy + h / 2 - (w * s + h * c) / 2) / sy,
  };
}

// Where the photo is actually drawn (same space rule as getImagePinnedBbox).
export function getImageEffectiveBbox(annotation, imageSize) {
  if (!annotation?.bbox || isImageDetached(annotation)) return annotation?.bbox;
  return getImagePinnedBbox(annotation, imageSize);
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

// Stored row + basemap-local metre delta → stored row patch. A pinned photo
// moves with its anchor (the card is the only 3D grip); a detached one moves
// alone, its anchor stays fixed.
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
  const imageLift3d = getImageCardLift(annotation) + delta.z;
  if (!isImageDetached(annotation)) {
    const targetPoint = { x: anchor.x + dx, y: anchor.y + dy };
    return {
      bbox: getImagePinnedBbox({ ...annotation, targetPoint }, imageSize),
      targetPoint,
      imageLift3d,
    };
  }
  return {
    bbox: {
      ...annotation.bbox,
      x: annotation.bbox.x + dx,
      y: annotation.bbox.y + dy,
    },
    targetPoint: anchor,
    imageLift3d,
  };
}
