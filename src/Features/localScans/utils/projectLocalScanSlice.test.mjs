import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import getFrame from "./getLocalScanSliceFrame.js";
import project from "./projectLocalScanSlice.js";

const frame = {
  rows: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  min: [0, 0, 0],
  max: [16, 16, 3],
};
const source = (positions, colors = positions.map(() => 120)) => ({
  positions: new Float32Array(positions),
  colors: new Uint8Array(colors),
});
test("inclusive Z selection averages RGB and counts density with +Y at the image top", async () => {
  const data = source(
    [0.2, 15.8, 1, 0.3, 15.7, 2, 0.2, 15.8, 0, 15.9, 0.1, 1],
    [255, 0, 0, 0, 0, 255, 0, 255, 0, 80, 120, 160]
  );
  const result = await project(data, {
    frame,
    lower: 1,
    upper: 2,
    resolution: 16,
  });
  assert.equal(result.pointCount, 3);
  assert.equal(result.maxCount, 2);
  assert.equal(result.pixelSize, 1);
  assert.deepEqual(Array.from(result.rgb.slice(0, 4)), [128, 0, 128, 255]);
  assert.deepEqual(Array.from(result.rgb.slice(-4)), [80, 120, 160, 255]);
  assert.equal(result.density[0], 0);
  assert.ok(result.density.at(-4) > 0 && result.density.at(-4) < 255);
  assert.deepEqual(Array.from(result.rgb.slice(4, 8)), [255, 255, 255, 255]);
});
test("maximal XY boundaries stay inside the raster and empty slices remain blank", async () => {
  const data = source([16, 0, 1]);
  const result = await project(data, {
    frame,
    lower: 1,
    upper: 1,
    resolution: 16,
  });
  assert.equal(result.pointCount, 1);
  assert.equal(result.rgb.at(-4), 120);
  const empty = await project(data, {
    frame,
    lower: 2,
    upper: 3,
    resolution: 16,
  });
  assert.equal(empty.pointCount, 0);
  assert.equal(empty.maxCount, 0);
  assert.ok(empty.density.every((value) => value === 255));
});
test("frame and slice use placed metres, displayed axes and the selected vertical axis", async () => {
  const root = new Group();
  const bounds = { min: [1, 2, 3], max: [2, 4, 6] };
  for (const up of ["Z", "Y"]) {
    applyPlacement(root, { up, scale: 2, origin: [1, 2, 3] });
    const transformed = getFrame(bounds, root.matrixWorld.elements, 90);
    const r = transformed.rows;
    const xyz = [0, 4, 8].map(
      (i) => r[i] * 2 + r[i + 1] * 4 + r[i + 2] * 6 + r[i + 3]
    );
    const expected = up === "Z" ? [4, 2, 6] : [-6, 2, 4];
    xyz.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9));
    const result = await project(source([2, 4, 6]), {
      frame: transformed,
      lower: expected[2] - 0.01,
      upper: expected[2] + 0.01,
      resolution: 16,
    });
    assert.equal(result.pointCount, 1);
  }
});
test("long-running projections can be cancelled at a chunk boundary", async () => {
  const data = source(Array(300000 * 3).fill(1));
  let cancelled = false,
    yields = 0;
  const result = await project(
    data,
    { frame, lower: 0, upper: 2, resolution: 16 },
    {
      isCancelled: () => cancelled,
      yieldControl: async () => {
        yields++;
        cancelled = true;
      },
    }
  );
  assert.equal(result, null);
  assert.equal(yields, 1);
});
test("degenerate bounds produce a finite raster and reversed intervals are rejected", async () => {
  const flat = { ...frame, min: [0, 0, 0], max: [0, 0, 0] };
  const result = await project(source([0, 0, 0]), {
    frame: flat,
    lower: 0,
    upper: 0,
    resolution: 16,
  });
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
  assert.equal(result.pointCount, 1);
  await assert.rejects(
    project(source([]), { frame, lower: 2, upper: 1 }),
    /Intervalle/
  );
});
