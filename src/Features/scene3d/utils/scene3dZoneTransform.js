// Frames of a scan base map (see docs/baseMaps/SCENE_3D_BASE_MAPS.md).
//
//   scan frame    metres, Z up — the PLY coordinates (minus `origin`).
//   zone frame    metres, the base-map-local frame of pixelToWorld: origin
//                 at the image centre, +X image right, +Y image up. It is
//                 the scan frame rotated by `zone.rotationDeg` (θ) about Z
//                 and centred on `zone.center`:
//                   q = R(−θ)·(p − center)      p = center + R(θ)·q
//   preview px    pixels of a top-down bake of the WHOLE scan (image top =
//                 scan +Y, no rotation): the picture the zone is drawn on.
//
// Pure module (node tests).

const DEG = Math.PI / 180;

// Mathematical (counter-clockwise, Y up) rotation of a 2D point.
export function rotate2d([x, y], deg) {
  const cos = Math.cos(deg * DEG);
  const sin = Math.sin(deg * DEG);
  return [x * cos - y * sin, x * sin + y * cos];
}

// zone: {rotationDeg, center: [x, y]}
export function scanToZoneLocal(zone, [px, py]) {
  return rotate2d(
    [px - zone.center[0], py - zone.center[1]],
    -(zone.rotationDeg || 0)
  );
}

export function zoneLocalToScan(zone, q) {
  const [x, y] = rotate2d(q, zone.rotationDeg || 0);
  return [x + zone.center[0], y + zone.center[1]];
}

// Point of the base map (REFERENCE image px, y down) → scan frame.
// baseMap: {scene3d, imageSize: {width, height}, meterByPx}
export function baseMapPxToScan({ scene3d, imageSize, meterByPx }, point) {
  const zone = scene3d?.zone;
  if (!zone || !imageSize || !(meterByPx > 0)) return null;
  const qx = (point.x - imageSize.width / 2) * meterByPx;
  const qy = -(point.y - imageSize.height / 2) * meterByPx;
  return zoneLocalToScan(zone, [qx, qy]);
}

// Bounding rectangle of a scan-frame polygon in the frame rotated by θ.
// → {center: [x, y] (scan frame), width, height} — the zone of an image
//   whose centre is `center` and whose axes are the rotated ones.
export function getZoneFromPolygon(polygonScan, rotationDeg) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  polygonScan.forEach((p) => {
    const [x, y] = rotate2d(p, -(rotationDeg || 0));
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  const center = rotate2d(
    [(minX + maxX) / 2, (minY + maxY) / 2],
    rotationDeg || 0
  );
  return { center, width: maxX - minX, height: maxY - minY };
}

// Preview image px (y down, image top = scan +Y) ↔ scan frame.
export function previewPxToScan(bbox, pxPerMeter, [ipx, ipy]) {
  return [bbox.min[0] + ipx / pxPerMeter, bbox.max[1] - ipy / pxPerMeter];
}

export function scanToPreviewPx(bbox, pxPerMeter, [sx, sy]) {
  return [(sx - bbox.min[0]) * pxPerMeter, (bbox.max[1] - sy) * pxPerMeter];
}
