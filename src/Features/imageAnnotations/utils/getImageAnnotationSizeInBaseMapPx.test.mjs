import assert from "node:assert/strict";
import { test } from "node:test";
import getImageAnnotationSizeInBaseMapPx from "./getImageAnnotationSizeInBaseMapPx.js";

const image = { imageSize: { width: 400, height: 200 } };

test("both scales known: image px converted through the two m/px ratios", () => {
  const size = getImageAnnotationSizeInBaseMapPx({
    image,
    meterByPx: 0.01,
    baseMapMeterByPx: 0.02,
    baseMapImageSize: { width: 5000, height: 4000 },
  });
  assert.deepEqual(size, { width: 200, height: 100 });
});

test("missing scale: capped to a quarter of the base map width, ratio kept", () => {
  const size = getImageAnnotationSizeInBaseMapPx({
    image,
    meterByPx: null,
    baseMapMeterByPx: 0.02,
    baseMapImageSize: { width: 1000, height: 800 },
  });
  assert.deepEqual(size, { width: 250, height: 125 });
});

test("missing scale on a large base map: native image px", () => {
  const size = getImageAnnotationSizeInBaseMapPx({
    image,
    baseMapImageSize: { width: 5000, height: 4000 },
  });
  assert.deepEqual(size, { width: 400, height: 200 });
});

test("no image size: null", () => {
  assert.equal(getImageAnnotationSizeInBaseMapPx({ image: {} }), null);
});
