import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Vector3 } from "three";
import getFrame from "./getLocalScanSectionFrame.js";
import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";
import project from "./projectLocalScanSlice.js";

test("only the slab of the cloud around the page is printed, on its pixels", async () => {
  // The scan root: turned about world Y and translated.
  const root = new Matrix4()
    .makeRotationY(0.4)
    .setPosition(new Vector3(2, 0.5, -1));
  const page = {
    orientation: "VERTICAL",
    angleDeg: 30,
    position: { x: 3, y: 2, z: -2 },
    width: 60,
    height: 40,
    meterByPx: 0.05,
  };
  const pageMatrix = getBaseMapGroupMatrix(page);
  const toSource = root.clone().invert();
  // Page local points (x right, y up, z = distance to the plane) → source.
  const sourceOf = (x, y, z) =>
    new Vector3(x, y, z).applyMatrix4(pageMatrix).applyMatrix4(toSource);
  const inSlab = sourceOf(0.52, 0.31, 0.004);
  const behind = sourceOf(0.52, 0.31, -0.2);
  const inFront = sourceOf(-0.4, 0.1, 0.3);
  const outside = sourceOf(40, 0, 0);

  const result = await project(
    {
      positions: new Float32Array([
        ...inSlab.toArray(),
        ...behind.toArray(),
        ...inFront.toArray(),
        ...outside.toArray(),
      ]),
      colors: new Uint8Array(12),
    },
    { frame: getFrame(root, page), lower: -0.01, upper: 0.01 }
  );

  assert.equal(result.width, 60);
  assert.equal(result.height, 40);
  assert.equal(result.pointCount, 1);
  const col = Math.floor(0.52 / page.meterByPx + page.width / 2);
  const row = Math.floor(-0.31 / page.meterByPx + page.height / 2);
  assert.ok(result.density[(row * result.width + col) * 4] < 255);
});
