import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canMergeMesh3dFacesAtEdge,
  deleteMesh3dFaces,
  getMesh3dEdgeFaces,
  mergeMesh3dFacesAtEdge,
} from "./editMesh3dParts.js";
import getMesh3dQties from "./getMesh3dQties.js";
import isMesh3dClosed from "./isMesh3dClosed.js";
import {
  getMesh3dEdgePartId,
  getMesh3dFacePartId,
  getSelectedMesh3dParts,
  parseMesh3dPartId,
} from "./mesh3dPartIds.js";
import splitMesh3dFace from "./splitMesh3dFace.js";

const v = (x, y, z) => ({ x, y, z });

function makeBox(w = 4, l = 2, h = 3) {
  return {
    vertices: [
      v(0, 0, 0),
      v(w, 0, 0),
      v(w, l, 0),
      v(0, l, 0),
      v(0, 0, h),
      v(w, 0, h),
      v(w, l, h),
      v(0, l, h),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] },
      { loop: [4, 5, 6, 7], holes: [] },
      { loop: [0, 1, 5, 4], holes: [] },
      { loop: [1, 2, 6, 5], holes: [] },
      { loop: [2, 3, 7, 6], holes: [] },
      { loop: [3, 0, 4, 7], holes: [] },
    ],
  };
}

const findVertex = (mesh, x, y, z) =>
  mesh.vertices.findIndex(
    (p) =>
      Math.abs(p.x - x) < 1e-9 &&
      Math.abs(p.y - y) < 1e-9 &&
      Math.abs(p.z - z) < 1e-9
  );

test("part ids round trip and ignore foreign ids", () => {
  assert.deepEqual(parseMesh3dPartId(getMesh3dFacePartId("ann", 3)), {
    annotationId: "ann",
    partType: "MESH3D_FACE",
    faceIndex: 3,
  });
  assert.deepEqual(parseMesh3dPartId(getMesh3dEdgePartId("ann", 7, 2)), {
    annotationId: "ann",
    partType: "MESH3D_EDGE",
    a: 2,
    b: 7,
  });
  assert.equal(parseMesh3dPartId("ann::SEG::2"), null);
  assert.equal(parseMesh3dPartId(null), null);

  const item = { type: "NODE", nodeId: "ann", partId: "ann::MESH3D_FACE::1" };
  assert.equal(getSelectedMesh3dParts(item, []).length, 1);
  assert.equal(
    getSelectedMesh3dParts(item, [
      "ann::MESH3D_FACE::0",
      "other::MESH3D_FACE::2",
      "ann::SEG::1",
    ]).length,
    1
  );
});

test("deleting a face opens the mesh; the last face cannot go", () => {
  const box = makeBox();
  const open = deleteMesh3dFaces(box, [1]);
  assert.equal(open.faces.length, 5);
  assert.equal(open.vertices.length, 8);
  assert.ok(!isMesh3dClosed(open));
  assert.equal(deleteMesh3dFaces(box, [0, 1, 2, 3, 4, 5]), null);
  // Two opposite faces gone: their 4-vertex rings stay used by the sides.
  assert.equal(deleteMesh3dFaces(box, [0, 1]).faces.length, 4);
});

test("an edge between two planes cannot be dissolved", () => {
  const box = makeBox();
  assert.deepEqual(getMesh3dEdgeFaces(box, 4, 5), [1, 2]);
  assert.equal(canMergeMesh3dFacesAtEdge(box, 4, 5), false);
  assert.equal(mergeMesh3dFacesAtEdge(box, 4, 5), null);
});

test("dissolving the edge of a split restores the original face", () => {
  const box = makeBox();
  const split = splitMesh3dFace(box, [v(2, 0, 3), v(2, 2, 3)]);
  const a = findVertex(split, 2, 0, 3);
  const b = findVertex(split, 2, 2, 3);
  assert.ok(canMergeMesh3dFacesAtEdge(split, a, b));
  const merged = mergeMesh3dFacesAtEdge(split, a, b);
  assert.equal(merged.faces.length, 6);
  assert.equal(merged.vertices.length, 8);
  assert.ok(isMesh3dClosed(merged));
  assert.ok(Math.abs(getMesh3dQties(merged).volume - 24) < 1e-9);
});

test("dissolving one edge of a multi-point split removes the whole cut", () => {
  const box = makeBox();
  const split = splitMesh3dFace(box, [
    v(1, 0, 3),
    v(1, 1, 3),
    v(3, 1, 3),
    v(3, 0, 3),
  ]);
  const a = findVertex(split, 1, 1, 3);
  const b = findVertex(split, 3, 1, 3);
  const merged = mergeMesh3dFacesAtEdge(split, a, b);
  assert.equal(merged.faces.length, 6);
  assert.equal(merged.vertices.length, 8);
  assert.ok(isMesh3dClosed(merged));
});

test("dissolving an edge of an inner loop fills the hole back", () => {
  const box = makeBox();
  const split = splitMesh3dFace(
    box,
    [v(1, 0.5, 3), v(3, 0.5, 3), v(3, 1.5, 3), v(1, 1.5, 3)],
    { closed: true }
  );
  const a = findVertex(split, 1, 0.5, 3);
  const b = findVertex(split, 3, 0.5, 3);
  const merged = mergeMesh3dFacesAtEdge(split, a, b);
  assert.equal(merged.faces.length, 6);
  assert.equal(merged.vertices.length, 8);
  assert.ok(merged.faces.every((face) => face.holes.length === 0));
  assert.ok(isMesh3dClosed(merged));
});
