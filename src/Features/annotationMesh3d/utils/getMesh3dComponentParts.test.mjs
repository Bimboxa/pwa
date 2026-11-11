// node src/Features/annotationMesh3d/utils/getMesh3dComponentParts.test.mjs
import assert from "node:assert/strict";

import getMesh3dComponentParts, {
  getMesh3dFacesEdges,
} from "./getMesh3dComponentParts.js";

// Unit cube on vertices `o … o + 7` (bottom 0-3, top 4-7).
const cubeFaces = (o) =>
  [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ].map((loop) => ({ loop: loop.map((i) => i + o), holes: [] }));

// one cube: the whole solid from any face

{
  const facesEdges = getMesh3dFacesEdges({ faces: cubeFaces(0) });
  const { faceIndices, edges } = getMesh3dComponentParts(facesEdges, 3);
  assert.equal(faceIndices[0], 3, "seed face first");
  assert.deepEqual([...faceIndices].sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(edges.length, 12);
  assert.ok(edges.every(([a, b]) => a < b));
  assert.equal(new Set(edges.map(([a, b]) => `${a}_${b}`)).size, 12);
}

// two disjoint cubes in one mesh: only the block of the seed

{
  const facesEdges = getMesh3dFacesEdges({
    faces: [...cubeFaces(0), ...cubeFaces(8)],
  });
  const second = getMesh3dComponentParts(facesEdges, 7);
  assert.deepEqual([...second.faceIndices].sort(), [10, 11, 6, 7, 8, 9]);
  assert.equal(second.edges.length, 12);
  assert.ok(second.edges.every(([a]) => a >= 8));
}

// faces touching at one vertex only are two blocks

{
  const facesEdges = getMesh3dFacesEdges({
    faces: [
      { loop: [0, 1, 2], holes: [] },
      { loop: [2, 3, 4], holes: [] },
    ],
  });
  const { faceIndices, edges } = getMesh3dComponentParts(facesEdges, 0);
  assert.deepEqual(faceIndices, [0]);
  assert.equal(edges.length, 3);
}

// a hole: its edges belong to the face and link the faces inside it

{
  const facesEdges = getMesh3dFacesEdges({
    faces: [
      { loop: [0, 1, 2, 3], holes: [[4, 6, 5]] },
      { loop: [4, 5, 6], holes: [] },
    ],
  });
  const { faceIndices, edges } = getMesh3dComponentParts(facesEdges, 0);
  assert.deepEqual(faceIndices, [0, 1]);
  assert.equal(edges.length, 7);
}

// a face left out (hidden) is not walked through; unknown seed is empty

{
  const facesEdges = getMesh3dFacesEdges({ faces: cubeFaces(0) }).filter(
    (entry) => entry.faceIndex !== 1
  );
  const { faceIndices } = getMesh3dComponentParts(facesEdges, 0);
  assert.deepEqual([...faceIndices].sort(), [0, 2, 3, 4, 5]);
  assert.deepEqual(getMesh3dComponentParts(facesEdges, 1), {
    faceIndices: [],
    edges: [],
  });
}

console.log("getMesh3dComponentParts: ok");
