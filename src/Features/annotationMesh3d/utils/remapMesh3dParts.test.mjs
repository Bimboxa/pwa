import assert from "node:assert/strict";
import { test } from "node:test";

import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "./mesh3dPartIds.js";
import remapMesh3dParts from "./remapMesh3dParts.js";

const v = (x, y, z) => ({ x, y, z });

// Box [x0,x1]×[y0,y1]×[0,z1], faces wound outward.
function makeBox(x0, x1, y0, y1, z1) {
  return {
    vertices: [
      v(x0, y0, 0),
      v(x1, y0, 0),
      v(x1, y1, 0),
      v(x0, y1, 0),
      v(x0, y0, z1),
      v(x1, y0, z1),
      v(x1, y1, z1),
      v(x0, y1, z1),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] }, // 0 bottom
      { loop: [4, 5, 6, 7], holes: [] }, // 1 top
      { loop: [0, 1, 5, 4], holes: [] }, // 2 front (-y)
      { loop: [1, 2, 6, 5], holes: [] }, // 3 right
      { loop: [2, 3, 7, 6], holes: [] }, // 4 back (+y)
      { loop: [3, 0, 4, 7], holes: [] }, // 5 left
    ],
  };
}

// Same solid, vertices and faces numbered backwards.
function renumber(mesh) {
  const n = mesh.vertices.length;
  return {
    vertices: [...mesh.vertices].reverse(),
    faces: [...mesh.faces]
      .reverse()
      .map((face) => ({ loop: face.loop.map((i) => n - 1 - i), holes: [] })),
  };
}

const face = (faceIndex) => ({
  annotationId: "ann",
  partType: MESH3D_FACE_PART,
  faceIndex,
});
const edge = (a, b) => ({
  annotationId: "ann",
  partType: MESH3D_EDGE_PART,
  a,
  b,
});

test("remapMesh3dParts: shrunk display -> un-shrunk, renumbered mesh", () => {
  // Displayed: faces 10 mm inward, top 5 mm lower.
  const displayed = makeBox(0.01, 3.99, 0.01, 0.19, 2.495);
  const real = renumber(makeBox(0, 4, 0, 0.2, 2.5));

  const parts = remapMesh3dParts(displayed, real, [
    face(2),
    face(1),
    edge(4, 5),
  ]);
  // Faces are reversed: old i -> 5 - i. Vertices: old i -> 7 - i.
  assert.deepEqual(parts, [{ ...face(3) }, { ...face(4) }, { ...edge(2, 3) }]);
});

test("remapMesh3dParts: thin band keeps the face side", () => {
  // 20 mm thick: front and back are both within the tolerance.
  const mesh = makeBox(0, 4, 0, 0.02, 2.5);
  const parts = remapMesh3dParts(mesh, mesh, [face(2), face(4)]);
  assert.deepEqual(
    parts.map((part) => part.faceIndex),
    [2, 4]
  );
});

test("remapMesh3dParts: unknown parts are dropped", () => {
  const mesh = makeBox(0, 4, 0, 0.2, 2.5);
  const far = makeBox(10, 14, 0, 0.2, 2.5);
  assert.deepEqual(remapMesh3dParts(mesh, far, [face(2), edge(0, 1)]), []);
  assert.deepEqual(remapMesh3dParts(mesh, mesh, [face(42)]), []);
  assert.deepEqual(remapMesh3dParts(null, mesh, [face(0)]), []);
});
