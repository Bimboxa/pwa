// Padding is based on the actual vertical extent, not the current slice.
export function getSliceDomain(min, max) {
  const padding = Math.max((max - min) * 0.05, 0.005);
  return { min: min - padding, max: max + padding };
}

export function getPreviewTransform(size, image, viewport) {
  const fit = Math.min(size.width / image.width, size.height / image.height);
  const scale = fit * viewport.zoom;
  return {
    scale,
    x: (size.width - image.width * scale) / 2 + viewport.x,
    y: (size.height - image.height * scale) / 2 + viewport.y,
  };
}

export function previewToImage(point, transform) {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}

export function zoomPreviewAt(viewport, factor, point, size) {
  const zoom = Math.max(0.25, Math.min(20, viewport.zoom * factor));
  const ratio = zoom / viewport.zoom;
  return {
    zoom,
    x:
      point.x -
      size.width / 2 -
      (point.x - size.width / 2 - viewport.x) * ratio,
    y:
      point.y -
      size.height / 2 -
      (point.y - size.height / 2 - viewport.y) * ratio,
  };
}

// Image Y points down, along displayed +Y (world +Z). Rotate the model (not
// the frame) about world Y: the first-to-second vector will point right in
// the recomputed projection.
export function getSliceAlignmentYaw(first, second) {
  const dx = second.x - first.x,
    dy = second.y - first.y;
  if (Math.hypot(dx, dy) < 2) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
