import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getHiddenMesh3dFaceIndices,
  getMesh3dFaceSignature,
  isMesh3dFaceHidden,
} from "./mesh3dFaceSignature.js";

// Stored form: [xNorm, yNorm, z above offsetZ]. A unit box, 6 faces.
function makeBox({ offsetZ = 2, dz = 0 } = {}) {
  return {
    offsetZ,
    mesh3d: {
      vertices: [
        [0.1, 0.1, 0 + dz],
        [0.2, 0.1, 0 + dz],
        [0.2, 0.2, 0 + dz],
        [0.1, 0.2, 0 + dz],
        [0.1, 0.1, 1 + dz],
        [0.2, 0.1, 1 + dz],
        [0.2, 0.2, 1 + dz],
        [0.1, 0.2, 1 + dz],
      ],
      faces: [
        { loop: [0, 3, 2, 1], holes: [] }, // bottom
        { loop: [4, 5, 6, 7], holes: [] }, // top
        { loop: [0, 1, 5, 4], holes: [] },
        { loop: [1, 2, 6, 5], holes: [] },
        { loop: [2, 3, 7, 6], holes: [] },
        { loop: [3, 0, 4, 7], holes: [] },
      ],
    },
  };
}

test("mesh3dFaceSignature: a signature only matches its own face", () => {
  const box = makeBox();
  const signature = getMesh3dFaceSignature(box, 1);
  assert.deepEqual([...getHiddenMesh3dFaceIndices(box, [signature])], [1]);
});

test("mesh3dFaceSignature: top and bottom share a footprint but not a signature", () => {
  const box = makeBox();
  const bottom = getMesh3dFaceSignature(box, 0);
  assert.equal(isMesh3dFaceHidden(box, box.mesh3d.faces[0], [bottom]), true);
  assert.equal(isMesh3dFaceHidden(box, box.mesh3d.faces[1], [bottom]), false);
});

test("mesh3dFaceSignature: survives a renumbering of faces and vertices", () => {
  const box = makeBox();
  const signature = getMesh3dFaceSignature(box, 3);
  // Reverse the vertices and the faces, rotate every loop.
  const n = box.mesh3d.vertices.length;
  const renumbered = {
    offsetZ: box.offsetZ,
    mesh3d: {
      vertices: [...box.mesh3d.vertices].reverse(),
      faces: [...box.mesh3d.faces].reverse().map((face) => {
        const loop = face.loop.map((i) => n - 1 - i);
        return { loop: [...loop.slice(1), loop[0]], holes: [] };
      }),
    },
  };
  // face 3 of 6 becomes face 2 once reversed
  assert.deepEqual(
    [...getHiddenMesh3dFaceIndices(renumbered, [signature])],
    [2]
  );
});

test("mesh3dFaceSignature: survives a z re-base moved into offsetZ", () => {
  const box = makeBox({ offsetZ: 2, dz: 0 });
  const signature = getMesh3dFaceSignature(box, 4);
  // Same absolute geometry: offsetZ lowered by 0.5, every z raised by 0.5.
  const rebased = makeBox({ offsetZ: 1.5, dz: 0.5 });
  assert.deepEqual([...getHiddenMesh3dFaceIndices(rebased, [signature])], [4]);
});

test("mesh3dFaceSignature: tolerates float noise, not a real move", () => {
  const box = makeBox();
  const signature = getMesh3dFaceSignature(box, 1);
  const noisy = makeBox();
  noisy.mesh3d.vertices = noisy.mesh3d.vertices.map(([x, y, z]) => [
    x + 1e-9,
    y - 1e-9,
    z + 1e-5,
  ]);
  assert.equal(
    isMesh3dFaceHidden(noisy, noisy.mesh3d.faces[1], [signature]),
    true
  );
  const moved = makeBox({ offsetZ: 2.05 });
  assert.equal(
    isMesh3dFaceHidden(moved, moved.mesh3d.faces[1], [signature]),
    false
  );
});

test("mesh3dFaceSignature: a face with a hole differs from the plain one", () => {
  const sheet = {
    offsetZ: 0,
    mesh3d: {
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0.4, 0.4, 0],
        [0.6, 0.4, 0],
        [0.6, 0.6, 0],
        [0.4, 0.6, 0],
      ],
      faces: [{ loop: [0, 1, 2, 3], holes: [[4, 5, 6, 7]] }],
    },
  };
  const signature = getMesh3dFaceSignature(sheet, 0);
  const plain = {
    offsetZ: 0,
    mesh3d: {
      vertices: sheet.mesh3d.vertices,
      faces: [{ loop: [0, 1, 2, 3], holes: [] }],
    },
  };
  assert.equal(
    isMesh3dFaceHidden(plain, plain.mesh3d.faces[0], [signature]),
    false
  );
  assert.equal(getMesh3dFaceSignature(sheet, 5), null);
});
