import { test } from "node:test";
import assert from "node:assert/strict";

import getSatelliteReferenceGeometry from "./getSatelliteReferenceGeometry.js";
import { projectToCc } from "../../satelliteMap/utils/ccProjection.js";

const CRS = "EPSG:3946";
const CENTER = { lat: 45.7578, lng: 4.8531 };

function squareBbox(sideMeters) {
  const c = projectToCc(CRS, CENTER);
  const h = sideMeters / 2;
  return { minx: c.x - h, miny: c.y - h, maxx: c.x + h, maxy: c.y + h };
}

test("derives the scale from the bbox, corrected by the CC scale factor", () => {
  const geometry = getSatelliteReferenceGeometry({
    crs: CRS,
    bbox: squareBbox(300),
    width: 2048,
    height: 2048,
  });
  assert.ok(Math.abs(geometry.scaleFactor - 1) < 2e-4);
  assert.ok(
    Math.abs(geometry.meterByPx - 300 / 2048 / geometry.scaleFactor) < 1e-12
  );
  assert.ok(Math.abs(geometry.centerLatLng.lat - CENTER.lat) < 1e-7);
  assert.ok(Math.abs(geometry.centerLatLng.lng - CENTER.lng) < 1e-7);
  assert.ok(geometry.topLeftLatLng.lat > CENTER.lat);
  assert.ok(geometry.topLeftLatLng.lng < CENTER.lng);
});

test("rejects an image stretched by the server", () => {
  assert.throws(
    () =>
      getSatelliteReferenceGeometry({
        crs: CRS,
        bbox: squareBbox(300),
        width: 2048,
        height: 1024,
      }),
    /proportions/
  );
});
