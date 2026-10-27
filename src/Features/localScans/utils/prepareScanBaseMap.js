// Projection rows run from +Y to -Y in the scan frame. Horizontal base maps
// run from -Z to +Z in world space, so reverse the raster rows at creation.
export default function prepareScanBaseMap(result, frame, mode, altitude = 0) {
  if (!Number.isFinite(altitude)) throw new Error("Altitude Z invalide.");
  const { width, height, pixelSize } = result;
  const pixels = new Uint8ClampedArray(result[mode].length);
  const stride = width * 4;
  for (let row = 0; row < height; row++) {
    pixels.set(
      result[mode].subarray(row * stride, (row + 1) * stride),
      (height - 1 - row) * stride
    );
  }
  // Use the raster extent, including its last partial pixel, not the bounds
  // midpoint: otherwise non-square projections shift by up to half a pixel.
  const u = frame.min[0] + (width * pixelSize) / 2;
  const v = frame.max[1] - (height * pixelSize) / 2;
  const x = frame.xDirection;
  const y = frame.yDirection;
  return {
    image: { ...result, [mode]: pixels },
    placement: {
      orientation: "HORIZONTAL",
      angleDeg: (Math.atan2(-x[2], x[0]) * 180) / Math.PI,
      position: {
        x: u * x[0] + v * y[0],
        y: altitude,
        z: u * x[2] + v * y[2],
      },
    },
  };
}
