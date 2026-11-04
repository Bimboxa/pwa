import assert from "node:assert/strict";
import { test } from "node:test";

import { getMesh3dSignedVolume } from "../../annotationMesh3d/utils/getMesh3dQties.js";
import isMesh3dClosed, {
  isMesh3dOriented,
} from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import {
  countMesh3dComponents,
  getFaceNormal,
} from "../../annotationMesh3d/utils/mesh3dTopology.js";
import orientMesh3dFaces from "../../annotationMesh3d/utils/orientMesh3d.js";
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

// --- mesh mode of « Fusionner les annotations »: no seed plane -------------

// Vertical sheet (a PX wall quad) with the given x span at y = y0.
function wallSheet(x0, x1, y0, z0, z1) {
  return {
    vertices: [
      { x: x0, y: y0, z: z0 },
      { x: x1, y: y0, z: z0 },
      { x: x1, y: y0, z: z1 },
      { x: x0, y: y0, z: z1 },
    ],
    faces: [{ loop: [0, 1, 2, 3], holes: [] }],
  };
}

// Horizontal sheet (a flat POLYGON) at z, CCW seen from above.
function slabSheet(x0, x1, y0, y1, z) {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x1, y: y0, z },
      { x: x1, y: y1, z },
      { x: x0, y: y1, z },
    ],
    faces: [{ loop: [0, 1, 2, 3], holes: [] }],
  };
}

test("L profile: a wall sheet 1 mm too low merges with the slab sheet it stands on", () => {
  // The PX wall converts 1 mm lower than the polygon it was drawn against
  // (no z-fight lift in extrudePolylineWall): the snap closes the gap.
  const wall = wallSheet(1, 2, 0, 3.709, 3.799);
  const slab = slabSheet(0, 4, 0, 3, 3.8);
  const result = mergeMesh3dSolids(wall, slab);
  assert.equal(result.ok, true);
  const { mesh } = result;
  assert.equal(mesh.faces.length, 2);
  assert.equal(mesh.vertices.length, 8);
  assert.ok(!isMesh3dClosed(mesh));
  assert.ok(isMesh3dOriented(mesh), "neighbors run the shared edge both ways");
  assert.equal(countMesh3dComponents(mesh), 1);
  // The wall's top vertices were spliced into the slab's edge (T-junction).
  const slabFace = mesh.faces.find((face) => face.loop.length === 6);
  assert.ok(slabFace, "slab loop gained the two wall vertices");
  const tops = mesh.vertices.filter((v) => Math.abs(v.z - 3.8) < 1e-9);
  assert.equal(tops.length, 6);
  // The slab keeps looking up (largest area keeps its side).
  const up = getFaceNormal(mesh.vertices, slabFace);
  assert.ok(up.z > 0.999);
});

test("two abutting boxes merge without a seed plane", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  const b = box(1, 2, 0, 0.2, 0, 2.5);
  const result = mergeMesh3dSolids(a, b);
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 6);
  assert.ok(isMesh3dClosed(result.mesh));
  assert.ok(getMesh3dSignedVolume(result.mesh) > 0);
});

test("disjoint meshes are refused without a seed plane", () => {
  const boxes = mergeMesh3dSolids(
    box(0, 1, 0, 0.2, 0, 2.5),
    box(1.5, 2, 0, 0.2, 0, 2.5)
  );
  assert.equal(boxes.ok, false);
  assert.equal(boxes.reason, MERGE_MESH3D_REASONS.NOT_TOUCHING);
  const sheets = mergeMesh3dSolids(
    wallSheet(1, 2, 0, 3.7, 3.79),
    slabSheet(0, 4, 0, 3, 3.8)
  );
  assert.equal(sheets.ok, false, "a 1 cm gap is not a contact");
  assert.equal(sheets.reason, MERGE_MESH3D_REASONS.NOT_TOUCHING);
});

test("a single shared vertex is a contact", () => {
  const a = slabSheet(0, 1, 0, 1, 0);
  const b = slabSheet(1, 2, 1, 2, 0);
  const result = mergeMesh3dSolids(a, b);
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 2);
  assert.equal(result.mesh.vertices.length, 7);
});

test("coplanar overlapping sheets become one face", () => {
  const a = slabSheet(0, 2, 0, 1, 0);
  const b = slabSheet(1, 3, 0, 1, 0);
  const result = mergeMesh3dSolids(a, b);
  assert.equal(result.ok, true);
  assert.equal(result.mesh.faces.length, 1);
  assert.equal(result.mesh.faces[0].loop.length, 4);
});

test("countMesh3dComponents welds coincident vertices", () => {
  const a = slabSheet(0, 1, 0, 1, 0);
  const b = slabSheet(1, 2, 0, 1, 0);
  assert.equal(countMesh3dComponents(a), 1);
  const soup = {
    vertices: [...a.vertices, ...b.vertices],
    faces: [a.faces[0], { loop: [4, 5, 6, 7], holes: [] }],
  };
  assert.equal(countMesh3dComponents(soup), 1, "shared edge, unwelded");
  const apart = {
    vertices: [...a.vertices, ...slabSheet(3, 4, 0, 1, 0).vertices],
    faces: soup.faces,
  };
  assert.equal(countMesh3dComponents(apart), 2);
});

test("orientMesh3dFaces: an L whose faces disagree is fixed, a 3-face edge is left", () => {
  const L = {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ],
    faces: [
      { loop: [0, 1, 2, 3], holes: [] }, // slab, up
      { loop: [0, 1, 5, 4], holes: [] }, // wall, runs 0→1 like the slab: wrong
    ],
  };
  assert.ok(!isMesh3dOriented(L));
  const fixed = orientMesh3dFaces(L);
  assert.ok(isMesh3dOriented(fixed));
  assert.deepEqual(
    fixed.faces[0].loop,
    [0, 1, 2, 3],
    "the big face keeps its side"
  );
  assert.deepEqual(fixed.faces[1].loop, [4, 5, 1, 0]);
  const fan = {
    vertices: L.vertices.concat([
      { x: 0, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
    ]),
    faces: [...L.faces, { loop: [0, 1, 7, 6], holes: [] }],
  };
  assert.equal(orientMesh3dFaces(fan), fan);
});
