// Run: node --test src/Features/baseMaps/utils/whitePageScale.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import getBlankBaseMapGeometry from "./getBlankBaseMapGeometry.js";
import {
  getWhitePageMeterByPx,
  getWhitePagePaperSizeMm,
  getWhitePageScale,
} from "./whitePageScale.js";

test("scale ↔ resolution round trip", () => {
  for (const scale of [10, 50, 100, 150, 500]) {
    assert.equal(getWhitePageScale(getWhitePageMeterByPx(scale)), scale);
  }
});

test("matches the blank page geometry", () => {
  const { pixelWidth, pixelHeight, meterByPx } = getBlankBaseMapGeometry({
    format: "paysage",
    size: "A3",
    scale: 100,
  });
  assert.equal(getWhitePageMeterByPx(100), meterByPx);
  assert.equal(getWhitePageScale(meterByPx), 100);
  const paper = getWhitePagePaperSizeMm({
    width: pixelWidth,
    height: pixelHeight,
  });
  // the raster is rounded to whole pixels
  assert.ok(Math.abs(paper.width - 420) < 0.2);
  assert.ok(Math.abs(paper.height - 297) < 0.2);
});

test("no scale", () => {
  assert.equal(getWhitePageScale(null), null);
  assert.equal(getWhitePageScale(0), null);
  assert.equal(getWhitePageMeterByPx(0), null);
  assert.equal(getWhitePagePaperSizeMm(null), null);
});
