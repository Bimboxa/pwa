// Geometry of the capture photos zone (mapEditor.imageModeImagesOverlay),
// px relative to the capture rect. Null fields resolve to the defaults: a
// column at the right of the rect, 30% of its width, starting under the
// legend's default spot (`legendDefaultBottom`, 0 when the legend was moved
// or hidden).

export const IMAGES_ZONE_DEFAULT_WIDTH_RATIO = 0.3;
export const IMAGES_ZONE_PADDING = 16;
export const IMAGES_ZONE_MIN_WIDTH = 120;

export default function resolveImagesOverlayGeometry(
  overlay,
  rect,
  { legendDefaultBottom = 0 } = {}
) {
  const o = overlay ?? {};
  const rectWidth = rect?.width ?? 0;
  const width = Math.max(
    IMAGES_ZONE_MIN_WIDTH,
    Math.round(o.width ?? rectWidth * IMAGES_ZONE_DEFAULT_WIDTH_RATIO)
  );
  return {
    x: o.x ?? Math.max(0, rectWidth - width - IMAGES_ZONE_PADDING),
    y: o.y ?? IMAGES_ZONE_PADDING + legendDefaultBottom,
    width,
    columns: Math.max(1, Math.round(o.columns ?? 2)),
    gap: o.gap ?? 8,
  };
}
