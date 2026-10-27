import assert from "node:assert/strict";
import test from "node:test";
import { Group, Matrix4, Vector3 } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import getFrame from "./getLocalScanBaseMapFrame.js";
import getPlacement from "./getLocalScanPlacementFromMatrix.js";
import getMatrix, {
  getBaseMapGroupMatrix,
  getLocalScanWorldMatrix,
} from "./getLocalScanMatrixInBaseMap.js";
import project from "./projectLocalScanSlice.js";

const close = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a placement is recovered from the world matrix of a moved scan", () => {
  for (const up of ["Z", "Y"]) {
    const root = new Group();
    const placement = { up, scale: 1.7, origin: [3, -2, 0.5], yaw: -48 };
    applyPlacement(root, placement);
    // Moved with a base map: turned about world Y and translated.
    const move = new Matrix4()
      .makeRotationY(0.6)
      .setPosition(new Vector3(4, 1, -9));
    const moved = move.clone().multiply(root.matrixWorld);
    const recovered = getPlacement(moved, up);
    const check = new Group();
    applyPlacement(check, recovered);
    const a = new Vector3(1, 2, 3).applyMatrix4(moved);
    const b = new Vector3(1, 2, 3).applyMatrix4(check.matrixWorld);
    assert.ok(
      a.distanceTo(b) < 1e-9,
      `${up}: ${a.toArray()} vs ${b.toArray()}`
    );
    close(recovered.scale, 1.7);
  }
});

test("a slice re-rendered in an existing base map lands on its pixels", async () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 1, origin: [0, 0, 0], yaw: 20 });
  // A source point and its world position, near the base map centre.
  const source = new Vector3(0.7, -0.4, 1.5);
  const world = source.clone().applyMatrix4(root.matrixWorld);
  const baseMap = {
    orientation: "HORIZONTAL",
    angleDeg: 35,
    position: { x: world.x + 0.5, y: 1.2, z: world.z - 0.3 },
    refWidth: 40,
    refHeight: 30,
    meterByPx: 0.1,
  };
  baseMap.localScan = { matrix: getMatrix(root.matrixWorld, baseMap) };
  close(
    new Vector3(1, 1, 1)
      .applyMatrix4(getLocalScanWorldMatrix(baseMap))
      .distanceTo(new Vector3(1, 1, 1).applyMatrix4(root.matrixWorld)),
    0
  );
  // Its expected base map pixel.
  const local = world
    .clone()
    .applyMatrix4(getBaseMapGroupMatrix(baseMap).invert());
  const col = Math.floor(local.x / baseMap.meterByPx + baseMap.refWidth / 2);
  const row = Math.floor(-local.y / baseMap.meterByPx + baseMap.refHeight / 2);
  const frame = getFrame(root.matrixWorld, baseMap);
  const result = await project(
    {
      // The second point falls outside the raster and is cropped.
      positions: new Float32Array([...source.toArray(), 100, 100, 1.5]),
      colors: new Uint8Array(6),
    },
    { frame, lower: world.y - 0.01, upper: world.y + 0.01 }
  );
  assert.equal(result.width, 40);
  assert.equal(result.height, 30);
  assert.equal(result.pointCount, 1);
  assert.ok(result.density[(row * result.width + col) * 4] < 255);
});
