import assert from "node:assert/strict";
import { test } from "node:test";

import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import { getFaceNormal } from "../../annotationMesh3d/utils/mesh3dTopology.js";
import mergeMesh3dSolids, {
  MERGE_MESH3D_REASONS,
} from "./mergeMesh3dSolids.js";

// Axis-aligned box as a LOCAL mesh (outward CCW faces), z up.
function box(x0, x1, y0, y1, z0, z1) {
  const vertices = [
    { x: x0, y: y0, z: z0 }, // 0
    { x: x1, y: y0, z: z0 }, // 1
    { x: x1, y: y1, z: z0 }, // 2
    { x: x0, y: y1, z: z0 }, // 3
    { x: x0, y: y0, z: z1 }, // 4
    { x: x1, y: y0, z: z1 }, // 5
    { x: x1, y: y1, z: z1 }, // 6
    { x: x0, y: y1, z: z1 }, // 7
  ];
  const faces = [
    { loop: [0, 3, 2, 1], holes: [] }, // bottom (-z)
    { loop: [4, 5, 6, 7], holes: [] }, // top (+z)
    { loop: [0, 1, 5, 4], holes: [] }, // front (-y)
    { loop: [2, 3, 7, 6], holes: [] }, // back (+y)
    { loop: [1, 2, 6, 5], holes: [] }, // right (+x)
    { loop: [3, 0, 4, 7], holes: [] }, // left (-x)
  ];
  return { vertices, faces };
}

const FRONT_PLANE = {
  point: { x: 0.5, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
};

const facesOnPlane = (mesh, normal, offset) =>
  mesh.faces.filter((face) => {
    const n = getFaceNormal(mesh.vertices, face);
    const p = mesh.vertices[face.loop[0]];
    return (
      n.x * normal.x + n.y * normal.y + n.z * normal.z > 0.999 &&
      Math.abs(p.x * normal.x + p.y * normal.y + p.z * normal.z - offset) < 1e-6
    );
  });

test("box winding: every face normal points outward", () => {
  const b = box(0, 1, 0, 0.2, 0, 2.5);
  const expected = [
    [0, 0, -1],
    [0, 0, 1],
    [0, -1, 0],
    [0, 1, 0],
    [1, 0, 0],
    [-1, 0, 0],
  ];
  b.faces.forEach((face, i) => {
    const n = getFaceNormal(b.vertices, face);
    assert.ok(
      Math.abs(n.x - expected[i][0]) < 1e-9 &&
        Math.abs(n.y - expected[i][1]) < 1e-9 &&
        Math.abs(n.z - expected[i][2]) < 1e-9,
      `face ${i}`
    );
  });
});

test("two abutting walls of the same height become one box", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  const result = mergeMesh3dSolids(a, b, { seedPlane: FRONT_PLANE });
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 6);
  assert.equal(result.mesh.vertices.length, 8);
  assert.ok(isMesh3dClosed(result.mesh));
  // One front face spanning both walls: no seam left on it.
  const fronts = facesOnPlane(result.mesh, { x: 0, y: -1, z: 0 }, 0);
  assert.equal(fronts.length, 1);
  assert.equal(fronts[0].loop.length, 4);
});

test("different heights: contact cap partly survives, fronts unioned", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 3);
  const result = mergeMesh3dSolids(a, b, { seedPlane: FRONT_PLANE });
  assert.equal(result.ok, true);
  assert.ok(isMesh3dClosed(result.mesh));
  // bottom, front, back, left, right, 2 tops, 1 partial cap (x = 1, z 2.5..3)
  assert.equal(result.mesh.faces.length, 8);
  const fronts = facesOnPlane(result.mesh, { x: 0, y: -1, z: 0 }, 0);
  assert.equal(fronts.length, 1);
  assert.equal(fronts[0].loop.length, 6);
  const caps = facesOnPlane(result.mesh, { x: -1, y: 0, z: 0 }, -1);
  assert.equal(caps.length, 1);
  const zs = caps[0].loop.map((vi) => result.mesh.vertices[vi].z).sort();
  assert.deepEqual(zs, [2.5, 2.5, 3, 3]);
});

test("coplanar but disjoint faces are refused", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1.5, 2, 0, 0.2, 0, 2.5);
  const result = mergeMesh3dSolids(a, b, { seedPlane: FRONT_PLANE });
  assert.equal(result.ok, false);
  assert.equal(result.reason, MERGE_MESH3D_REASONS.NOT_TOUCHING);
});

test("a face split inside one mesh keeps its seam after the merge", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  // Split A's front face (loop [0, 1, 5, 4]) by a vertical line at x = 0.5.
  a.vertices.push({ x: 0.5, y: 0, z: 0 }, { x: 0.5, y: 0, z: 2.5 }); // 8, 9
  a.faces[2] = { loop: [0, 8, 9, 4], holes: [] };
  a.faces.push({ loop: [8, 1, 5, 9], holes: [] });
  a.faces[0] = { loop: [0, 3, 2, 1, 8], holes: [] }; // bottom gets the vertex
  a.faces[1] = { loop: [4, 9, 5, 6, 7], holes: [] }; // top too
  assert.ok(isMesh3dClosed(a));
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  const result = mergeMesh3dSolids(a, b, { seedPlane: FRONT_PLANE });
  assert.equal(result.ok, true);
  assert.ok(isMesh3dClosed(result.mesh));
  const fronts = facesOnPlane(result.mesh, { x: 0, y: -1, z: 0 }, 0);
  // Left half of A stays its own face; right half of A + front of B = one.
  assert.equal(fronts.length, 2);
});

test("a mesh wound inside out is re-oriented from its clicked face", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  b.faces = b.faces.map((face) => ({
    loop: [...face.loop].reverse(),
    holes: [],
  }));
  // B's front now looks inward (+y): the hook passes that normal as clicked.
  const result = mergeMesh3dSolids(a, b, {
    seedPlane: FRONT_PLANE,
    clickedNormal: { x: 0, y: 1, z: 0 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 6);
  assert.ok(isMesh3dClosed(result.mesh));
  const fronts = facesOnPlane(result.mesh, { x: 0, y: -1, z: 0 }, 0);
  assert.equal(fronts.length, 1);
});

test("a seed plane read on a shrunk display (10 mm off) still matches", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  const result = mergeMesh3dSolids(a, b, {
    seedPlane: {
      point: { x: 0.5, y: 0.01, z: 1 },
      normal: { x: 0, y: 1, z: 0 },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 6);
});
