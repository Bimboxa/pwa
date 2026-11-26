// Template dimensions of a RECTANGLE (`size {width, height}` in `sizeUnit`)
// converted to base map pixels. Each dimension is returned independently and
// is `null` when it cannot be resolved (missing value, or metres without a
// base map scale).

function toPx(value, sizeUnit, meterByPx) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (sizeUnit === "PX") return value;
  // "M" (default unit of the Rectangle shape)
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  return value / meterByPx;
}

export default function getRectangleSizeInPx({ size, sizeUnit, meterByPx }) {
  return {
    width: toPx(size?.width, sizeUnit, meterByPx),
    height: toPx(size?.height, sizeUnit, meterByPx),
  };
}
