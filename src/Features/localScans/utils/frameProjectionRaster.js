// Largest framed raster (the preview may be zoomed out down to 1/4).
const MAX_PIXELS = 25_000_000;

// The projection raster re-cut to the preview framing: `rect` (image px,
// may overflow the raster on any side) becomes the new raster — outside
// pixels white — and the frame minimum moves with it, so prepareScanBaseMap
// centres the base map on the framing and every point keeps its place.
// → {result, frame}
export default function frameProjectionRaster(result, frame, rect) {
  const x0 = Math.round(rect.x),
    y0 = Math.round(rect.y);
  const width = Math.max(1, Math.round(rect.width)),
    height = Math.max(1, Math.round(rect.height));
  if (width * height > MAX_PIXELS)
    throw new Error("Cadrage trop large : zoomez dans l’aperçu.");
  const framed = { ...result, width, height };
  for (const mode of ["density", "rgb"]) {
    if (!result[mode]) continue;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const fromX = Math.max(0, x0),
      toX = Math.min(result.width, x0 + width);
    if (toX > fromX)
      for (
        let row = Math.max(0, y0);
        row < Math.min(result.height, y0 + height);
        row++
      ) {
        const source = (row * result.width + fromX) * 4;
        pixels.set(
          result[mode].subarray(source, source + (toX - fromX) * 4),
          ((row - y0) * width + (fromX - x0)) * 4
        );
      }
    framed[mode] = pixels;
  }
  const px = result.pixelSize;
  return {
    result: framed,
    frame: {
      ...frame,
      min: [frame.min[0] + x0 * px, frame.min[1] + y0 * px, frame.min[2]],
      max: [
        frame.min[0] + (x0 + width) * px,
        frame.min[1] + (y0 + height) * px,
        frame.max[2],
      ],
    },
  };
}
