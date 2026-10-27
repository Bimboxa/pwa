import assert from "node:assert/strict";
import test from "node:test";
import { Group, Object3D, Vector3 } from "three";
import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "../../baseMaps/js/getBaseMapTransform.js";
import applyPlacement from "./applyLocalScanPlacement.js";
import getFrame from "./getLocalScanSliceFrame.js";
import project from "./projectLocalScanSlice.js";
import prepare from "./prepareScanBaseMap.js";

for (const yaw of [0, 37, 90, -120]) {
  test(`projected points align with the base map at a ${yaw} degree user frame`, async () => {
    const root = new Group();
    applyPlacement(root, { up: "Z", scale: 2, origin: [12, -4, 1], yaw: 23 });
    root.updateMatrixWorld(true);
    const bounds = { min: [-3, -1, 0], max: [8, 4, 3] };
    const frame = getFrame(bounds, root.matrixWorld.elements, yaw);
    const positions = new Float32Array([-2, 0, 1, 3, 2, 1.5, 7, 3, 2]);
    const colors = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const result = await project(
      { positions, colors },
      { frame, lower: frame.min[2], upper: frame.max[2], resolution: 64 }
    );
    const image = result;
    const placement = prepare(result, frame, 2.75);
    const map = new Object3D();
    const euler = getBaseMapEuler(placement);
    map.rotation.set(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER);
    map.position.set(
      placement.position.x,
      placement.position.y,
      placement.position.z
    );
    map.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) {
      const offset = image.rgb.findIndex(
        (_, index) =>
          index % 4 === 0 &&
          image.rgb[index + i] === 255 &&
          image.rgb[index + ((i + 1) % 3)] === 0
      );
      assert.ok(offset >= 0);
      const pixel = offset / 4;
      const col = pixel % image.width;
      const row = Math.floor(pixel / image.width);
      const actual = map.localToWorld(
        new Vector3(
          (col + 0.5 - image.width / 2) * image.pixelSize,
          -(row + 0.5 - image.height / 2) * image.pixelSize,
          0
        )
      );
      const expected = new Vector3(
        ...positions.slice(i * 3, i * 3 + 3)
      ).applyMatrix4(root.matrixWorld);
      expected.y = 2.75;
      assert.ok(
        actual.distanceTo(expected) <= image.pixelSize / Math.sqrt(2) + 1e-9,
        `${actual.toArray()} vs ${expected.toArray()}`
      );
    }
  });
}

test("the center includes the partial raster extent", () => {
  const result = { width: 1, height: 2, pixelSize: 0.6 };
  const frame = {
    min: [10, 20, 0],
    max: [10.5, 21, 2],
    xDirection: [1, 0, 0],
    yDirection: [0, 0, 1],
  };
  const { position } = prepare(result, frame);
  assert.ok(Math.abs(position.x - 10.3) < 1e-9);
  assert.equal(position.y, 0);
  assert.ok(Math.abs(position.z - 20.6) < 1e-9);
  assert.throws(() => prepare(result, frame, NaN));
});
