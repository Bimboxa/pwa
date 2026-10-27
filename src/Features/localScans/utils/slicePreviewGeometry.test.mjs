import assert from "node:assert/strict";
import test from "node:test";
import { Group, Vector3 } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import getFrame from "./getLocalScanSliceFrame.js";
import {
  getSliceDomain,
  getPreviewTransform,
  previewToImage,
  zoomPreviewAt,
  getSliceAlignmentYaw,
} from "./slicePreviewGeometry.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("slider domain extends point elevations by five percent on each side", () => {
  assert.deepEqual(getSliceDomain(-3, 7), { min: -3.5, max: 7.5 });
  assert.deepEqual(getSliceDomain(2, 2), { min: 1.995, max: 2.005 });
});
test("zoom remains anchored under the pointer and picking accounts for pan and letterboxing", () => {
  const size = { width: 500, height: 280 },
    image = { width: 400, height: 600 };
  const viewport = { zoom: 2.5, x: 81, y: -42 },
    pointer = { x: 270, y: 91 };
  const before = previewToImage(
    pointer,
    getPreviewTransform(size, image, viewport)
  );
  const zoomed = zoomPreviewAt(viewport, 3, pointer, size);
  const after = previewToImage(
    pointer,
    getPreviewTransform(size, image, zoomed)
  );
  close(before.x, after.x);
  close(before.y, after.y);
  const shifted = getPreviewTransform(size, image, {
    ...zoomed,
    x: zoomed.x + 38,
    y: zoomed.y - 19,
  });
  const afterPan = previewToImage(
    { x: pointer.x + 38, y: pointer.y - 19 },
    shifted
  );
  close(before.x, afterPan.x);
  close(before.y, afterPan.y);
  assert.equal(zoomPreviewAt(viewport, 100, pointer, size).zoom, 20);
});
test("two image picks rotate the model to positive displayed X while keeping its origin and height", () => {
  for (const up of ["Z", "Y"])
    for (const axesYaw of [0, 37, -120]) {
      const root = new Group();
      const placement = { up, scale: 2, origin: [3, 4, 5], yaw: 24 };
      applyPlacement(root, placement);
      const start = new Vector3(4, 6, 8),
        end = new Vector3(9, 8, 8);
      if (up === "Y") end.y = start.y;
      const bounds = { min: [0, 0, 0], max: [10, 10, 10] };
      const project = (point) => {
        const frame = getFrame(bounds, root.matrixWorld.elements, axesYaw);
        const r = frame.rows;
        const coordinates = [0, 4, 8].map(
          (i) =>
            r[i] * point.x + r[i + 1] * point.y + r[i + 2] * point.z + r[i + 3]
        );
        return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
      };
      const a = project(start),
        b = project(end);
      const delta = getSliceAlignmentYaw(a, b);
      assert.notEqual(delta, null);
      applyPlacement(root, { ...placement, yaw: placement.yaw + delta });
      const a2 = project(start),
        b2 = project(end);
      close(a2.y, b2.y);
      assert.ok(b2.x > a2.x);
      close(a2.z, a.z);
      close(b2.z, b.z);
      close(
        new Vector3(...placement.origin)
          .applyMatrix4(root.matrixWorld)
          .length(),
        0
      );
    }
  assert.equal(getSliceAlignmentYaw({ x: 1, y: 1 }, { x: 1, y: 1 }), null);
});
