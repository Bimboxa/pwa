export function getDxfFrame(bounds, maxSize = 2400) {
  const spanX = bounds.maxX - bounds.minX,
    spanY = bounds.maxY - bounds.minY;
  const span = Math.max(spanX, spanY);
  if (!(span > 0) || !Number.isFinite(span))
    throw new Error("L’emprise du dessin est vide ou invalide.");
  const padding = span * 0.025;
  const scale = maxSize / (span + padding * 2);
  return {
    minX: bounds.minX - padding,
    maxY: bounds.maxY + padding,
    scale,
    width: Math.max(1, Math.ceil((spanX + padding * 2) * scale)),
    height: Math.max(1, Math.ceil((spanY + padding * 2) * scale)),
  };
}

export function dxfPointToPixel(p, frame) {
  return {
    x: (p.x - frame.minX) * frame.scale,
    y: (frame.maxY - p.y) * frame.scale,
  };
}
