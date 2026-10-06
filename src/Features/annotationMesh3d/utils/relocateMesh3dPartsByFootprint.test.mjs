import assert from "node:assert/strict";
import { test } from "node:test";

import { MESH3D_EDGE_PART, MESH3D_FACE_PART } from "./mesh3dPartIds.js";
import relocateMesh3dPartsByFootprint from "./relocateMesh3dPartsByFootprint.js";

const v = (x, y, z) => ({ x, y, z });

// Open PX wall of two segments: (0,0)→(1,0)→(1,1), bottom z 0, tops given.
function makeWall({ top0 = 1, top1 = 1, top2 = 1 } = {}) {
  return {
    vertices: [
      v(0, 0, 0),
      v(1, 0, 0),
      v(1, 0, top1),
      v(0, 0, top0),
      v(1, 1, 0),
      v(1, 1, top2),
    ],
    faces: [
      { loop: [0, 1, 2, 3], holes: [] }, // segment 0
      { loop: [1, 4, 5, 2], holes: [] }, // segment 1
    ],
  };
}

test("relocateMesh3dPartsByFootprint: a face keeps its footprint after a vertex offset, even renumbered", () => {
  const from = makeWall();
  const moved = makeWall({ top1: 1.4 });
  // Renumber the faces backwards.
  const to = { vertices: moved.vertices, faces: [...moved.faces].reverse() };
  const parts = relocateMesh3dPartsByFootprint(from, to, [
    { partType: MESH3D_FACE_PART, faceIndex: 1 },
  ]);
  assert.deepEqual(parts, [{ partType: MESH3D_FACE_PART, faceIndex: 0 }]);
});

test("relocateMesh3dPartsByFootprint: top and bottom of a prism are told apart by z", () => {
  const prism = {
    vertices: [
      v(0, 0, 0),
      v(1, 0, 0),
      v(1, 1, 0),
      v(0, 1, 0),
      v(0, 0, 2),
      v(1, 0, 2),
      v(1, 1, 2),
      v(0, 1, 2),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] }, // bottom
      { loop: [4, 5, 6, 7], holes: [] }, // top
    ],
  };
  const taller = {
    vertices: prism.vertices.map((p) => (p.z > 0 ? v(p.x, p.y, 3) : p)),
    faces: [prism.faces[1], prism.faces[0]], // swapped
  };
  const parts = relocateMesh3dPartsByFootprint(prism, taller, [
    { partType: MESH3D_FACE_PART, faceIndex: 1 },
    { partType: MESH3D_FACE_PART, faceIndex: 0 },
  ]);
  assert.deepEqual(parts, [
    { partType: MESH3D_FACE_PART, faceIndex: 0 },
    { partType: MESH3D_FACE_PART, faceIndex: 1 },
  ]);
});

test("relocateMesh3dPartsByFootprint: edges follow their XY ends, unknown parts are dropped", () => {
  const from = makeWall();
  const to = makeWall({ top0: 1.2 });
  const parts = relocateMesh3dPartsByFootprint(from, to, [
    { partType: MESH3D_EDGE_PART, a: 2, b: 3 }, // top edge of segment 0
    { partType: MESH3D_FACE_PART, faceIndex: 7 }, // no such face
  ]);
  assert.deepEqual(parts, [{ partType: MESH3D_EDGE_PART, a: 2, b: 3 }]);
});
