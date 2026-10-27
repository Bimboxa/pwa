// Horizontal base maps run from -Z (image top) to +Z in world space, which
// is the projection row order: the raster is used as is and only its pose
// (center, yaw, altitude) is derived here.
export default function prepareScanBaseMap(result, frame, altitude = 0) {
  if (!Number.isFinite(altitude)) throw new Error("Altitude Z invalide.");
  const { width, height, pixelSize } = result;
  // Use the raster extent, including its last partial pixel, not the bounds
  // midpoint: otherwise non-square projections shift by up to half a pixel.
  const u = frame.min[0] + (width * pixelSize) / 2;
  const v = frame.min[1] + (height * pixelSize) / 2;
  const x = frame.xDirection;
  const y = frame.yDirection;
  return {
    orientation: "HORIZONTAL",
    angleDeg: (Math.atan2(-x[2], x[0]) * 180) / Math.PI,
    position: {
      x: u * x[0] + v * y[0],
      y: altitude,
      z: u * x[2] + v * y[2],
    },
  };
}
