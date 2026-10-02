import assert from "node:assert/strict";
import { test } from "node:test";

import getMeshPaintMetrics, {
  getMeshPaintMetricsByBaseMapId,
} from "./getMeshPaintMetrics.js";

test("plain record: non-square image size + meterByPx", () => {
  const metrics = getMeshPaintMetrics({
    image: { imageSize: { width: 1000, height: 600 } },
    meterByPx: 0.01,
  });
  assert.deepEqual(metrics, {
    imageWidth: 1000,
    imageHeight: 600,
    meterByPx: 0.01,
  });
});

test("BaseMap instance: getters win (reference size of a versioned map)", () => {
  const metrics = getMeshPaintMetrics({
    image: { imageSize: { width: 10, height: 10 } },
    meterByPx: 0.5,
    getImageSize: () => ({ width: 1200, height: 800 }),
    getMeterByPx: () => 0.02,
  });
  assert.deepEqual(metrics, {
    imageWidth: 1200,
    imageHeight: 800,
    meterByPx: 0.02,
  });
});

test("missing scale or size → null (no fallback values)", () => {
  assert.equal(getMeshPaintMetrics(null), null);
  assert.equal(
    getMeshPaintMetrics({ image: { imageSize: { width: 1000, height: 600 } } }),
    null
  );
  assert.equal(
    getMeshPaintMetrics({
      image: { imageSize: { width: 1000, height: 600 } },
      getMeterByPx: () => null,
    }),
    null
  );
  assert.equal(getMeshPaintMetrics({ meterByPx: 0.01 }), null);
  assert.equal(
    getMeshPaintMetrics({
      image: { imageSize: { width: 0, height: 600 } },
      meterByPx: 0.01,
    }),
    null
  );
});

test("by id: only the base maps with complete metrics", () => {
  const byId = getMeshPaintMetricsByBaseMapId([
    {
      id: "bm1",
      image: { imageSize: { width: 1000, height: 600 } },
      meterByPx: 0.01,
    },
    { id: "bm2", image: { imageSize: { width: 1000, height: 600 } } },
    null,
  ]);
  assert.deepEqual(Object.keys(byId), ["bm1"]);
  assert.equal(byId.bm1.imageHeight, 600);
});
