import assert from "node:assert/strict";
import { test } from "node:test";

import {
  baseMapPxToScan,
  getZoneFromPolygon,
  previewPxToScan,
  rotate2d,
  scanToPreviewPx,
  scanToZoneLocal,
  zoneLocalToScan,
} from "./scene3dZoneTransform.js";

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const nearPoint = (p, expected, eps) => {
  near(p[0], expected[0], eps);
  near(p[1], expected[1], eps);
};

test("scan ↔ zone round trip", () => {
  const zone = { rotationDeg: 37, center: [12.5, -4] };
  for (const p of [
    [0, 0],
    [12.5, -4],
    [-3, 8],
    [100, 42],
  ]) {
    nearPoint(zoneLocalToScan(zone, scanToZoneLocal(zone, p)), p);
  }
  // θ = 90°: zone +X is scan +Y
  nearPoint(
    zoneLocalToScan({ rotationDeg: 90, center: [0, 0] }, [1, 0]),
    [0, 1]
  );
});

test("getZoneFromPolygon: bounding rect in the rotated frame", () => {
  // a 4 × 2 rectangle rotated by 30° about (10, 10)
  const corners = [
    [-2, -1],
    [2, -1],
    [2, 1],
    [-2, 1],
  ].map((p) => {
    const [x, y] = rotate2d(p, 30);
    return [x + 10, y + 10];
  });
  const zone = getZoneFromPolygon(corners, 30);
  nearPoint(zone.center, [10, 10]);
  near(zone.width, 4);
  near(zone.height, 2);
});

test("the zone drawn on the rotated preview: θ = φ (SVG clockwise)", () => {
  // Preview: whole scan baked at ppm px / m, image top = scan +Y. The zone
  // editor shows the image rotated by φ (SVG rotate, clockwise on screen)
  // about its centre and lets the user draw in the axis-aligned content
  // frame (px, y down). A content point c maps to an image px through the
  // inverse screen rotation, then to the scan frame. With
  // zone.rotationDeg = φ, the zone-local metres of that scan point must be
  // the content offset from the zone centre, y flipped — this pins the
  // sign convention between the editor and the 3D pose.
  const bbox = { min: [3, 5, 0], max: [23, 15, 4] };
  const ppm = 50;
  const w = 20 * ppm;
  const h = 10 * ppm;
  const rotateScreen = ([x, y], deg) => {
    const a = (deg * Math.PI) / 180;
    return [
      x * Math.cos(a) - y * Math.sin(a),
      x * Math.sin(a) + y * Math.cos(a),
    ];
  };
  const contentToScan = (c, phi) => {
    const [ix, iy] = rotateScreen(c, -phi);
    return previewPxToScan(bbox, ppm, [ix + w / 2, iy + h / 2]);
  };
  for (const phi of [0, 17, -60, 90, 135]) {
    const zoneCentreContent = [120, -80];
    const centerScan = contentToScan(zoneCentreContent, phi);
    const zone = { rotationDeg: phi, center: centerScan };
    for (const c of [
      [0, 0],
      [300, 40],
      [-50, 200],
    ]) {
      const scan = contentToScan(c, phi);
      const q = scanToZoneLocal(zone, scan);
      nearPoint(q, [
        (c[0] - zoneCentreContent[0]) / ppm,
        -(c[1] - zoneCentreContent[1]) / ppm,
      ]);
    }
  }
});

test("preview px ↔ scan", () => {
  const bbox = { min: [3, 5, 0], max: [23, 15, 4] };
  nearPoint(previewPxToScan(bbox, 10, [0, 0]), [3, 15]);
  nearPoint(previewPxToScan(bbox, 10, [200, 100]), [23, 5]);
  nearPoint(scanToPreviewPx(bbox, 10, [13, 10]), [100, 50]);
});

test("baseMapPxToScan: image centre = zone centre, image top = zone +Y", () => {
  const baseMap = {
    scene3d: { zone: { rotationDeg: 90, center: [10, 20] } },
    imageSize: { width: 400, height: 200 },
    meterByPx: 0.05,
  };
  nearPoint(baseMapPxToScan(baseMap, { x: 200, y: 100 }), [10, 20]);
  // image top (zone +Y, 5 m up) is scan −X with θ = 90°
  nearPoint(baseMapPxToScan(baseMap, { x: 200, y: 0 }), [5, 20]);
  // image right (zone +X, 10 m) is scan +Y
  nearPoint(baseMapPxToScan(baseMap, { x: 400, y: 100 }), [10, 30]);
});
