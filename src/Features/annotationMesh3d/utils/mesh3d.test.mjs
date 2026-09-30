import assert from "node:assert/strict";
import { test } from "node:test";

import applyAffineToMesh3d from "./applyAffineToMesh3d.js";
import buildFlatMesh3d from "./buildFlatMesh3d.js";
import buildMesh3dFromTriangles from "./buildMesh3dFromTriangles.js";
import fitAffine2d from "./fitAffine2d.js";
import getMesh3dQties from "./getMesh3dQties.js";
import getPushPullRange from "./getPushPullRange.js";
import isMesh3dClosed from "./isMesh3dClosed.js";
import locatePathOnMesh3d from "./locatePathOnMesh3d.js";
import { mesh3dFromLocal, mesh3dToLocal } from "./mesh3dFrame.js";
import {
  getFaceLoops,
  getFaceNormal,
  getLoopAreaVector,
} from "./mesh3dTopology.js";
import projectMesh3dToRings from "./projectMesh3dToRings.js";
import pushPullMesh3dFace from "./pushPullMesh3dFace.js";
import splitMesh3dFace from "./splitMesh3dFace.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const v = (x, y, z) => ({ x, y, z });

// Axis-aligned box [0,w]×[0,l]×[0,h], faces wound CCW seen from outside.
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
      { loop: [0, 3, 2, 1], holes: [] }, // bottom
      { loop: [4, 5, 6, 7], holes: [] }, // top
      { loop: [0, 1, 5, 4], holes: [] }, // y = 0
      { loop: [1, 2, 6, 5], holes: [] }, // x = w
      { loop: [2, 3, 7, 6], holes: [] }, // y = l
      { loop: [3, 0, 4, 7], holes: [] }, // x = 0
    ],
  };
}

// Positive when the faces are wound outward.
function signedVolume(mesh) {
  let sum = 0;
  for (const face of mesh.faces) {
    let av = { x: 0, y: 0, z: 0 };
    for (const loop of getFaceLoops(face)) {
      const a = getLoopAreaVector(mesh.vertices, loop);
      av = { x: av.x + a.x, y: av.y + a.y, z: av.z + a.z };
    }
    const p = mesh.vertices[face.loop[0]];
    sum += p.x * av.x + p.y * av.y + p.z * av.z;
  }
  return sum / 6;
}

function findFace(mesh, predicate) {
  return mesh.faces.findIndex((face) =>
    predicate(getFaceNormal(mesh.vertices, face), face)
  );
}

const faceAtZ = (mesh, z) =>
  findFace(
    mesh,
    (n, face) =>
      n.z > 0.99 &&
      face.loop.every((vi) => Math.abs(mesh.vertices[vi].z - z) < 1e-9)
  );

// Triangle soup of a prism extruded from a CCW 2D outline already cut in
// triangles (corner indices), like ExtrudeGeometry: caps + side quads.
function extrudeSoup(outline, capTris, h) {
  const positions = [];
  const push = (p, z) => positions.push(p[0], p[1], z);
  for (const [a, b, c] of capTris) {
    push(outline[a], h);
    push(outline[b], h);
    push(outline[c], h);
    push(outline[a], 0);
    push(outline[c], 0);
    push(outline[b], 0);
  }
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    push(p, 0);
    push(q, 0);
    push(q, h);
    push(p, 0);
    push(q, h);
    push(p, h);
  }
  return positions;
}

// L-shaped wall footprint (3 × 3, 1 thick).
const L_OUTLINE = [
  [0, 0],
  [3, 0],
  [3, 1],
  [1, 1],
  [1, 3],
  [0, 3],
];
const L_TRIS = [
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 5],
  [3, 4, 5],
];
const L_AREA = 5;

test("box fixture is a closed solid with the expected quantities", () => {
  const box = makeBox();
  assert.ok(isMesh3dClosed(box));
  const qties = getMesh3dQties(box);
  near(qties.volume, 24);
  near(qties.surface, 2 * (8 + 12 + 6));
  assert.ok(signedVolume(box) > 0);
});

test("pulling a whole face stretches its neighbors (same counts)", () => {
  const box = makeBox();
  const pulled = pushPullMesh3dFace(box, 1, 1);
  assert.ok(isMesh3dClosed(pulled));
  assert.equal(pulled.vertices.length, 8);
  assert.equal(pulled.faces.length, 6);
  near(getMesh3dQties(pulled).volume, 4 * 2 * 4);
  assert.ok(signedVolume(pulled) > 0);

  const pushed = pushPullMesh3dFace(box, 1, -0.5);
  assert.ok(isMesh3dClosed(pushed));
  assert.equal(pushed.vertices.length, 8);
  assert.equal(pushed.faces.length, 6);
  near(getMesh3dQties(pushed).volume, 4 * 2 * 2.5);
});

test("push range of a box face stops short of the opposite face", () => {
  const range = getPushPullRange(makeBox(), 1);
  near(range.min, -(3 - 0.01));
  assert.equal(range.max, Infinity);
});

test("a flat drawn face becomes a closed prism, both ways", () => {
  const flat = buildFlatMesh3d([
    v(0, 0, 1),
    v(2, 0, 1),
    v(2, 1, 1),
    v(0, 1, 1),
  ]);
  assert.equal(flat.faces.length, 1);
  assert.ok(!isMesh3dClosed(flat));
  assert.deepEqual(getPushPullRange(flat, 0), {
    min: -Infinity,
    max: Infinity,
  });

  for (const d of [0.5, -0.5]) {
    const prism = pushPullMesh3dFace(flat, 0, d);
    assert.ok(isMesh3dClosed(prism), `closed for d=${d}`);
    assert.equal(prism.vertices.length, 8);
    assert.equal(prism.faces.length, 6);
    near(getMesh3dQties(prism).volume, 1);
    assert.ok(signedVolume(prism) > 0, `outward for d=${d}`);
  }
});

test("buildFlatMesh3d rejects non-planar contours and honors the hint", () => {
  assert.equal(
    buildFlatMesh3d([v(0, 0, 0), v(1, 0, 0), v(1, 1, 0.5), v(0, 1, 0)]),
    null
  );
  const down = buildFlatMesh3d(
    [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)],
    v(0, 0, -1)
  );
  near(getFaceNormal(down.vertices, down.faces[0]).z, -1);
});

test("an L-shaped wall soup converts to 12 vertices / 8 faces", () => {
  const mesh = buildMesh3dFromTriangles({
    positions: extrudeSoup(L_OUTLINE, L_TRIS, 2.5),
  });
  assert.equal(mesh.vertices.length, 12);
  assert.equal(mesh.faces.length, 8);
  assert.ok(isMesh3dClosed(mesh));
  near(getMesh3dQties(mesh).volume, L_AREA * 2.5, 1e-6);
  assert.ok(signedVolume(mesh) > 0);

  // Pull the end face at x = 3 (normal +x): still ONE mesh, same counts.
  const end = findFace(mesh, (n) => n.x > 0.99);
  const pulled = pushPullMesh3dFace(mesh, end, 0.3);
  assert.ok(isMesh3dClosed(pulled));
  assert.equal(pulled.vertices.length, 12);
  assert.equal(pulled.faces.length, 8);
  near(getMesh3dQties(pulled).volume, L_AREA * 2.5 + 0.3 * 1 * 2.5, 1e-6);
});

test("a line across a face splits it and keeps the mesh closed", () => {
  const box = makeBox();
  const path = [v(2, 0, 3), v(2, 2, 3)];
  assert.equal(locatePathOnMesh3d(box, path), 1);

  const split = splitMesh3dFace(box, path);
  assert.equal(split.vertices.length, 10);
  assert.equal(split.faces.length, 7);
  assert.ok(isMesh3dClosed(split));
  near(getMesh3dQties(split).volume, 24);

  // Pull one half: the other half gets a step, still one closed mesh.
  const half = findFace(
    split,
    (n, face) =>
      n.z > 0.99 && face.loop.every((vi) => split.vertices[vi].x <= 2 + 1e-9)
  );
  const pulled = pushPullMesh3dFace(split, half, 0.5);
  assert.ok(isMesh3dClosed(pulled));
  near(getMesh3dQties(pulled).volume, 24 + 2 * 2 * 0.5);
  assert.ok(signedVolume(pulled) > 0);

  const pushed = pushPullMesh3dFace(split, half, -1);
  assert.ok(isMesh3dClosed(pushed));
  near(getMesh3dQties(pushed).volume, 24 - 2 * 2 * 1);
  assert.ok(signedVolume(pushed) > 0);
});

test("a multi-point path splits a face through interior points", () => {
  const box = makeBox();
  const split = splitMesh3dFace(box, [
    v(1, 0, 3),
    v(1, 1, 3),
    v(3, 1, 3),
    v(3, 0, 3),
  ]);
  assert.equal(split.faces.length, 7);
  assert.equal(split.vertices.length, 12);
  assert.ok(isMesh3dClosed(split));
  near(getMesh3dQties(split).surface, getMesh3dQties(box).surface);
});

test("a closed loop inside a face makes a pocket or a boss", () => {
  const box = makeBox();
  const loop = [v(1, 0.5, 3), v(3, 0.5, 3), v(3, 1.5, 3), v(1, 1.5, 3)];
  const split = splitMesh3dFace(box, loop, { closed: true });
  assert.equal(split.faces.length, 7);
  assert.equal(split.vertices.length, 12);
  assert.equal(split.faces[1].holes.length, 1);
  assert.ok(isMesh3dClosed(split));

  const inner = split.faces.length - 1;
  near(getPushPullRange(split, inner).min, -(3 - 0.01));

  const pocket = pushPullMesh3dFace(split, inner, -0.2);
  assert.ok(isMesh3dClosed(pocket));
  near(getMesh3dQties(pocket).volume, 24 - 2 * 1 * 0.2);
  assert.ok(signedVolume(pocket) > 0);

  const boss = pushPullMesh3dFace(split, inner, 0.2);
  assert.ok(isMesh3dClosed(boss));
  near(getMesh3dQties(boss).volume, 24 + 2 * 1 * 0.2);
});

test("a closed loop touching the boundary splits like an open path", () => {
  const box = makeBox();
  // Rectangle resting on the y = 0 edge of the top face.
  const rect = [v(1, 0, 3), v(3, 0, 3), v(3, 1, 3), v(1, 1, 3)];
  const split = splitMesh3dFace(box, rect, { closed: true });
  assert.equal(split.faces.length, 7);
  assert.ok(isMesh3dClosed(split));
  const areas = split.faces
    .filter((face) => getFaceNormal(split.vertices, face).z > 0.99)
    .map((face) => getLoopAreaVector(split.vertices, face.loop).z / 2)
    .sort((a, b) => a - b);
  near(areas[0], 2);
  near(areas[1], 6);
});

test("paths that split nothing return null", () => {
  const box = makeBox();
  // Along an edge.
  assert.equal(splitMesh3dFace(box, [v(0, 0, 3), v(4, 0, 3)]), null);
  // Off the mesh.
  assert.equal(splitMesh3dFace(box, [v(0, 0, 9), v(4, 2, 9)]), null);
  // Dangling inside the face.
  assert.equal(splitMesh3dFace(box, [v(1, 1, 3), v(2, 1, 3)]), null);
});

test("oblique neighbors: pull adds side faces, push is refused", () => {
  // Triangular prism.
  const mesh = buildMesh3dFromTriangles({
    positions: extrudeSoup(
      [
        [0, 0],
        [4, 0],
        [0, 3],
      ],
      [[0, 1, 2]],
      2
    ),
  });
  assert.equal(mesh.faces.length, 5);
  assert.ok(isMesh3dClosed(mesh));

  const side = findFace(mesh, (n) => n.y < -0.99);
  assert.equal(getPushPullRange(mesh, side).min, 0);

  const pulled = pushPullMesh3dFace(mesh, side, 0.5);
  assert.ok(isMesh3dClosed(pulled));
  near(getMesh3dQties(pulled).volume, 12 + 4 * 2 * 0.5, 1e-6);
  assert.ok(signedVolume(pulled) > 0);
});

test("plan projection of a solid, a vertical sheet and a frame", () => {
  const box = projectMesh3dToRings(makeBox());
  assert.equal(box.contour.length, 4);
  assert.equal(box.holes.length, 0);

  const wall = buildFlatMesh3d([
    v(0, 0, 0),
    v(2, 0, 0),
    v(2, 0, 1),
    v(0, 0, 1),
  ]);
  const thin = projectMesh3dToRings(wall);
  assert.equal(thin.contour.length, 4);
  const ys = thin.contour.map((p) => p.y);
  near(Math.max(...ys) - Math.min(...ys), 0.005);

  // Flat frame: the inner loop face removed leaves a hole.
  const flat = buildFlatMesh3d([
    v(0, 0, 0),
    v(4, 0, 0),
    v(4, 4, 0),
    v(0, 4, 0),
  ]);
  const framed = splitMesh3dFace(
    flat,
    [v(1, 1, 0), v(3, 1, 0), v(3, 3, 0), v(1, 3, 0)],
    { closed: true }
  );
  const full = projectMesh3dToRings(framed);
  assert.equal(full.holes.length, 0);
  const frame = projectMesh3dToRings({
    vertices: framed.vertices,
    faces: [framed.faces[0]],
  });
  assert.equal(frame.contour.length, 4);
  assert.equal(frame.holes.length, 1);
});

test("a box pulled out of a flat sheet stays a consistent open surface", () => {
  const flat = buildFlatMesh3d([
    v(0, 0, 0),
    v(4, 0, 0),
    v(4, 4, 0),
    v(0, 4, 0),
  ]);
  const framed = splitMesh3dFace(
    flat,
    [v(1, 1, 0), v(3, 1, 0), v(3, 3, 0), v(1, 3, 0)],
    { closed: true }
  );
  const hat = pushPullMesh3dFace(framed, 1, 1);
  // Sheet with a hole + 4 walls + the lid.
  assert.equal(hat.faces.length, 6);
  assert.ok(faceAtZ(hat, 1) >= 0);
});

test("fitAffine2d recovers a translation, a rotation and a collinear move", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 0, y: 1 },
  ];
  const moved = fitAffine2d(
    square.map((p) => ({ from: p, to: { x: p.x + 5, y: p.y - 3 } }))
  );
  near(moved.a, 1);
  near(moved.e, 1);
  near(moved.b, 0);
  near(moved.c, 5);
  near(moved.f, -3);

  // Quarter turn around the origin: (x, y) -> (-y, x).
  const turned = fitAffine2d(
    square.map((p) => ({ from: p, to: { x: -p.y, y: p.x } }))
  );
  near(turned.a, 0);
  near(turned.b, -1);
  near(turned.d, 1);
  near(turned.e, 0);

  // Two points only (collinear): similarity fallback.
  const line = fitAffine2d([
    { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    { from: { x: 2, y: 0 }, to: { x: 1, y: 3 } },
  ]);
  near(line.a, 0);
  near(line.d, 1);
  near(line.c, 1);
  near(line.f, 1);
});

test("stored <-> local round trip re-bases z on offsetZ", () => {
  const metrics = { imageWidth: 2000, imageHeight: 1000, meterByPx: 0.02 };
  const box = makeBox();
  box.vertices.forEach((p) => (p.z += 1.5));
  const { mesh3d, offsetZ } = mesh3dFromLocal(box, metrics, 0.25);
  near(offsetZ, 1.75);
  near(Math.min(...mesh3d.vertices.map((p) => p[2])), 0);
  // Local origin is the image center.
  near(mesh3d.vertices[0][0], 0.5);
  near(mesh3d.vertices[0][1], 0.5);

  const back = mesh3dToLocal(mesh3d, metrics);
  back.vertices.forEach((p, i) => {
    near(p.x, box.vertices[i].x, 1e-9);
    near(p.y, box.vertices[i].y, 1e-9);
    near(p.z, box.vertices[i].z - 1.5, 1e-9);
  });
});

test("applyAffineToMesh3d moves the plan coords and un-mirrors the faces", () => {
  const metrics = { imageWidth: 1000, imageHeight: 1000, meterByPx: 0.01 };
  const imageSize = { width: 1000, height: 1000 };
  const { mesh3d } = mesh3dFromLocal(makeBox(), metrics);

  const moved = applyAffineToMesh3d(
    mesh3d,
    { a: 1, b: 0, c: 100, d: 0, e: 1, f: -50 },
    imageSize
  );
  near(moved.vertices[0][0], mesh3d.vertices[0][0] + 0.1);
  near(moved.vertices[0][1], mesh3d.vertices[0][1] - 0.05);
  near(moved.vertices[4][2], mesh3d.vertices[4][2]);

  const mirrored = applyAffineToMesh3d(
    mesh3d,
    { a: -1, b: 0, c: 1000, d: 0, e: 1, f: 0 },
    imageSize
  );
  assert.ok(signedVolume(mesh3dToLocal(mirrored, metrics)) > 0);
});

test("offsetZ is stored to 0.1 mm without moving the mesh", () => {
  const metrics = { imageWidth: 1000, imageHeight: 1000, meterByPx: 0.01 };
  const box = makeBox();
  // float32-like noise on the altitude of the bottom
  box.vertices.forEach((p) => (p.z += -1.0000000128746034));
  const { mesh3d, offsetZ } = mesh3dFromLocal(box, metrics, 0);
  assert.equal(offsetZ, -1);
  // absolute z = stored z + offsetZ is unchanged
  mesh3d.vertices.forEach((p, i) =>
    near(p[2] + offsetZ, box.vertices[i].z, 1e-12)
  );
  assert.equal(mesh3dFromLocal(makeBox(), metrics, -0.00001).offsetZ, 0);
});
