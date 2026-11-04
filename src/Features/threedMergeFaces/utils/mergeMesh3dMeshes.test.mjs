import assert from "node:assert/strict";
import { test } from "node:test";

import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import mergeMesh3dMeshes from "./mergeMesh3dMeshes.js";
import { MERGE_MESH3D_REASONS } from "./mergeMesh3dSolids.js";

function box(x0, x1, y0, y1, z0, z1) {
  const vertices = [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x1, y: y1, z: z0 },
    { x: x0, y: y1, z: z0 },
    { x: x0, y: y0, z: z1 },
    { x: x1, y: y0, z: z1 },
    { x: x1, y: y1, z: z1 },
    { x: x0, y: y1, z: z1 },
  ];
  const faces = [
    { loop: [0, 3, 2, 1], holes: [] },
    { loop: [4, 5, 6, 7], holes: [] },
    { loop: [0, 1, 5, 4], holes: [] },
    { loop: [2, 3, 7, 6], holes: [] },
    { loop: [1, 2, 6, 5], holes: [] },
    { loop: [3, 0, 4, 7], holes: [] },
  ];
  return { vertices, faces };
}

test("a chain given out of order is folded in a working order", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  const c = box(2, 3, 0, 0.2, 0, 2.5);
  // A–C do not touch, B touches both: C waits for the second pass.
  const result = mergeMesh3dMeshes([a, c, b]);
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 6);
  assert.ok(isMesh3dClosed(result.mesh));
});

test("a mesh touching nothing refuses the whole merge", () => {
  const result = mergeMesh3dMeshes([
    box(0, 1, 0, 0.2, 0, 2.5),
    box(1, 2, 0, 0.2, 0, 2.5),
    box(5, 6, 0, 0.2, 0, 2.5),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, MERGE_MESH3D_REASONS.NOT_TOUCHING);
});

test("mergePair is injectable and other refusals stop the fold", () => {
  const calls = [];
  const result = mergeMesh3dMeshes(
    [box(0, 1, 0, 1, 0, 1), box(1, 2, 0, 1, 0, 1)],
    {
      mergePair: (a, b) => {
        calls.push([a, b]);
        return { ok: false, reason: "FAILED" };
      },
    }
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(result, { ok: false, reason: "FAILED" });
});
