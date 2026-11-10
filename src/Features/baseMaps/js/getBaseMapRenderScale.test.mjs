import assert from "node:assert/strict";
import { test } from "node:test";

import getBaseMapForRender from "../../threedEditor/js/utilsAnnotationsManager/getBaseMapForRender.js";
import pixelToWorld from "../../threedEditor/js/utilsAnnotationsManager/pixelToWorld.js";
import getBaseMapRenderScale, {
  getGlbModelUnitsPerPx,
} from "./getBaseMapRenderScale.js";

const scene3d = {
  format: "GLB",
  relativeToBaseMap: true,
  zone: { width: 18, height: 12, center: [3, 2] },
};

test("an uncalibrated plan and its annotations use the native GLB frame at any raster resolution", () => {
  for (const refWidth of [1800, 5400]) {
    const refHeight = (refWidth * 2) / 3;
    const baseMap = {
      scene3d,
      meterByPx: null,
      refWidth,
      refHeight,
      image: { imageSize: { width: 900, height: 600 } },
    };
    const metrics = getBaseMapForRender(baseMap);
    assert.equal(getBaseMapRenderScale(baseMap) * refWidth, scene3d.zone.width);
    assert.equal(metrics.imageWidth, refWidth);
    assert.equal(metrics.imageHeight, refHeight);

    const labelAnchor = pixelToWorld(
      { x: refWidth * 0.75, y: refHeight * 0.25 },
      metrics
    );
    assert.deepEqual(labelAnchor, { x: 4.5, y: 3 });
    assert.equal(baseMap.meterByPx, null);
  }
});

test("the model scale only fills a missing metric calibration on linked GLB plans", () => {
  const baseMap = { scene3d, meterByPx: 0.02, refWidth: 1800, refHeight: 1200 };
  assert.equal(getGlbModelUnitsPerPx(baseMap), 0.01);
  assert.equal(getBaseMapRenderScale(baseMap), 0.02);
  assert.equal(getBaseMapForRender(baseMap).meterByPx, 0.02);

  const ordinaryMap = { ...baseMap, scene3d: null, meterByPx: null };
  assert.equal(getBaseMapRenderScale(ordinaryMap), null);
  assert.equal(getBaseMapForRender(ordinaryMap).meterByPx, 0.01);
});
