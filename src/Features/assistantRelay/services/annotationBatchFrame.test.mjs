import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sameBatchScale,
  batchFrameDifferences,
  batchFrameErrorDetail,
} from "./annotationBatchFrame.js";
const frame = {
  imageKey: "plan-v1",
  refSize: { width: 1000, height: 800 },
  meterByPx: 0.01,
};
test("scale accepts float noise across magnitudes but not real changes or invalid values", () => {
  for (const scale of [1e-12, 0.000123456789, 0.01, 1, 100]) {
    assert.equal(sameBatchScale(scale, scale * (1 + 1e-12)), true);
    assert.equal(sameBatchScale(scale, scale * 1.000001), false);
  }
  for (const bad of [undefined, "0.01", NaN, Infinity, 0, -1, null])
    assert.equal(sameBatchScale(0.01, bad), false);
  assert.equal(sameBatchScale(null, null), true);
  assert.equal(sameBatchScale(NaN, NaN), false);
});
test("only calibration has tolerance: image and reference changes remain strict", () => {
  assert.deepEqual(
    batchFrameDifferences(frame, { ...frame, meterByPx: 0.009999999999999998 }),
    []
  );
  assert.deepEqual(
    batchFrameDifferences(frame, { ...frame, imageKey: "plan-v2" }),
    ["imageKey"]
  );
  assert.deepEqual(
    batchFrameDifferences(frame, {
      ...frame,
      refSize: { width: 1001, height: 800 },
    }),
    ["refSize"]
  );
  assert.match(
    batchFrameErrorDetail(frame, { ...frame, meterByPx: 0.02 }),
    /published=0.01, current=0.02/
  );
  assert.deepEqual(batchFrameDifferences(frame, null), [
    "imageKey",
    "meterByPx",
    "refSize",
  ]);
});
