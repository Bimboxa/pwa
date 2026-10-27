import assert from "node:assert/strict";
import test from "node:test";
import { Group, Vector3 } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import project from "./projectLocalScanSlice.js";
import {
  getScanPreviewFrame,
  getScanZonePlacement,
  toScanHorizontal,
} from "./localScanZone.js";
import { scanToPreviewPx } from "../../scene3d/utils/scene3dZoneTransform.js";

const close = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

const fromHorizontal = (up, [h1, h2, w]) =>
  up === "Y" ? [h1, w, -h2] : [h1, h2, w];

test("the preview raster matches the Scene3dZoneEditor pixel convention", async () => {
  for (const up of ["Z", "Y"]) {
    const corners = [
      [0, 0, 0],
      [8, 0, 1],
      [8, 4, 2],
      [0, 4, 3],
    ];
    const points = corners.map((c) => fromHorizontal(up, c));
    const min = [0, 1, 2].map((a) => Math.min(...points.map((p) => p[a])));
    const max = [0, 1, 2].map((a) => Math.max(...points.map((p) => p[a])));
    const frame = getScanPreviewFrame({ min, max }, up);
    // A single marker point at h = (7.5, 3.5): top-right in the editor.
    const marker = fromHorizontal(up, [7.5, 3.5, 1]);
    const result = await project(
      {
        positions: new Float32Array([...points.flat(), ...marker]),
        colors: new Uint8Array(15),
      },
      { frame, lower: frame.min[2], upper: frame.max[2], resolution: 16 }
    );
    const ppm = 1 / result.pixelSize;
    const [px, py] = scanToPreviewPx(frame.bbox, ppm, [7.5, 3.5]);
    const pixel = Math.floor(py) * result.width + Math.floor(px);
    assert.ok(result.density[pixel * 4] < 255, `${up}: marker pixel`);
    assert.deepEqual(frame.bbox.min.slice(0, 2), [0, 0]);
    assert.deepEqual(frame.bbox.max.slice(0, 2), [8, 4]);
    assert.deepEqual(toScanHorizontal(up, ...marker), [7.5, 3.5, 1]);
  }
});

test("the zone X axis becomes the displayed X axis and its centre scene zero", () => {
  for (const up of ["Z", "Y"])
    for (const rotationDeg of [0, 30, -115])
      for (const axesYaw of [0, 40]) {
        const polygon = [
          [2, 1],
          [6, 1],
          [6, 3],
          [2, 3],
        ];
        const zone = { up, polygon, rotationDeg, zMin: 0.5, recenter: true };
        const placement = { scale: 1, ...getScanZonePlacement(zone, axesYaw) };
        const root = new Group();
        applyPlacement(root, placement);
        const a = (rotationDeg * Math.PI) / 180;
        const toWorld = (h) =>
          new Vector3(...fromHorizontal(up, h)).applyMatrix4(root.matrixWorld);
        const p0 = toWorld([0, 0, 0.5]);
        const p1 = toWorld([Math.cos(a), Math.sin(a), 0.5]);
        const direction = p1.sub(p0);
        const yaw = (axesYaw * Math.PI) / 180;
        const userX = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        close(direction.dot(userX), 1);
        close(direction.y, 0);
        // The zone centre (bounding box in the rotated frame) at zMin → 0.
        const centre = new Vector3(...placement.origin).applyMatrix4(
          root.matrixWorld
        );
        close(centre.length(), 0);
        close(toWorld([0, 0, 0.5]).y, 0);
      }
});
