import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import getSliceFrame from "./getLocalScanSliceFrame.js";
import getHeightFrame from "./getLocalScanHeightFrame.js";
import getHeightAtPx from "./getLocalScanHeightAtPx.js";
import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";
import prepare from "./prepareScanBaseMap.js";
import project from "./projectLocalScanSlice.js";
import rasterize from "./rasterizeLocalScanHeightMap.js";

test("the height under an image pixel is the highest point there", async () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 1, origin: [0, 0, 0], yaw: 20 });
  const bounds = { min: [-4, -4, 0], max: [4, 4, 3] };
  // two points on the same vertical, one on the floor, one at 2.5 m, plus a
  // far corner point at 1 m
  const positions = new Float32Array([1, 2, 0.2, 1, 2, 2.5, -3, -3, 1]);
  const colors = new Uint8Array(9).fill(128);
  const sliceFrame = getSliceFrame(bounds, root.matrixWorld.elements, 20);
  const result = await project(
    { positions, colors },
    { frame: sliceFrame, lower: -1, upper: 4, resolution: 80 }
  );
  const altitude = 1.5;
  const placement = prepare(result, sliceFrame, altitude);
  const baseMap = {
    ...placement,
    refWidth: result.width,
    refHeight: result.height,
    meterByPx: result.pixelSize,
  };
  const frame = getHeightFrame(root.matrixWorld, baseMap, bounds);
  const heightMap = rasterize(positions, frame);
  assert.ok(heightMap.cols > 0 && heightMap.rows > 0);
  // the image pixel under the stacked points (the map is finer than the
  // image: sample where the points are, not at every pixel centre)
  const imageSize = { width: result.width, height: result.height };
  const r = frame.rows;
  const [x, y, z] = [1, 2, 2.5];
  const u = r[0] * x + r[1] * y + r[2] * z + r[3];
  const w = r[4] * x + r[5] * y + r[6] * z + r[7];
  const best = getHeightAtPx(
    { imageSize, meterByPx: result.pixelSize },
    {
      x: u / result.pixelSize + result.width / 2,
      y: result.height / 2 - w / result.pixelSize,
    },
    heightMap
  );
  // highest point: 2.5 m above the scan floor, the plane sits at Z=altitude
  // but the scan is placed with its source z=0 at world Y=0, so the height
  // above the plane is 2.5 − 1.5
  assert.ok(Math.abs(best - (2.5 - altitude)) < 0.01, `got ${best}`);
  // outside the image: null
  assert.equal(
    getHeightAtPx(
      { imageSize, meterByPx: result.pixelSize },
      { x: -5, y: -5 },
      heightMap
    ),
    null
  );
});

test("a moved base map keeps the same heights (frame glued to the map)", async () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 1, origin: [0, 0, 0], yaw: 0 });
  const bounds = { min: [0, 0, 0], max: [2, 2, 1] };
  // away from the cell boundaries (1 cm cells)
  const positions = new Float32Array([1.004, 1.003, 0.75]);
  const baseMap = {
    orientation: "HORIZONTAL",
    angleDeg: 0,
    position: { x: 0, y: 0, z: 0 },
    refWidth: 20,
    refHeight: 20,
    meterByPx: 0.1,
  };
  const a = rasterize(
    positions,
    getHeightFrame(root.matrixWorld, baseMap, bounds)
  );
  // the base map and its glued scan move together: the moved root is
  // group(moved) · group(base)⁻¹ · root
  const moved = { ...baseMap, position: { x: 5, y: 2, z: -3 }, angleDeg: 40 };
  const movedRoot = new Group();
  movedRoot.matrixWorld
    .copy(getBaseMapGroupMatrix(moved))
    .multiply(getBaseMapGroupMatrix(baseMap).invert())
    .multiply(root.matrixWorld);
  const b = rasterize(
    positions,
    getHeightFrame(movedRoot.matrixWorld, moved, bounds)
  );
  assert.deepEqual([...a.data], [...b.data]);
  for (const key of ["min", "max"])
    for (let axis = 0; axis < 3; axis++)
      assert.ok(Math.abs(a.bbox[key][axis] - b.bbox[key][axis]) < 1e-9);
});
