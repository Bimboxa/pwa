import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeFaceBasis,
  edgeLength,
  faceArea,
  faceCentroid,
  faceOverlapArea,
  flipFace,
  localGeometryBox,
  loopAreaVector,
  maxVertexShift,
  orientFaceLoops,
  projectPoint,
  unprojectPoint,
} from "./meshPaintGeometry.js";
import { near, nearV, v } from "./meshPaintTestFixtures.mjs";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const rect = (x0, y0, x1, y1, z = 0) => [
  v(x0, y0, z),
  v(x1, y0, z),
  v(x1, y1, z),
  v(x0, y1, z),
];
const face = (contour, normal, holes = []) => ({
  polygons: [{ contour, holes }],
  normal,
});

test("loopAreaVector: |v| = area, direction = CCW side", () => {
  nearV(loopAreaVector(rect(0, 0, 2, 3)), v(0, 0, 6));
  nearV(loopAreaVector([...rect(0, 0, 2, 3)].reverse()), v(0, 0, -6));
  // Vertical loop (wall front, y = 0) wound CCW seen from -y.
  const wall = [v(0, 0, 0), v(4, 0, 0), v(4, 0, 2.5), v(0, 0, 2.5)];
  nearV(loopAreaVector(wall), v(0, -10, 0));
});

test("faceArea: contour minus holes, any winding, multi-polygon", () => {
  const hole = rect(1, 1, 2, 2);
  near(faceArea(face(rect(0, 0, 4, 3), v(0, 0, 1), [hole])), 11);
  near(faceArea(face(rect(0, 0, 4, 3), v(0, 0, 1), [[...hole].reverse()])), 11);
  const multi = {
    polygons: [
      { contour: rect(0, 0, 1, 1), holes: [] },
      { contour: [...rect(5, 5, 7, 6)].reverse(), holes: [] },
    ],
    normal: v(0, 0, 1),
  };
  near(faceArea(multi), 3);
  near(faceArea(null), 0);
});

test("edgeLength", () => {
  near(edgeLength({ points: [v(0, 0, 0), v(3, 4, 0)] }), 5);
  near(edgeLength({ points: [v(0, 0, 0), v(0, 0, 2), v(0, 3, 2)] }), 5);
});

test("computeFaceBasis: orthonormal and right-handed for any normal", () => {
  const normals = [
    v(0, 0, 1),
    v(0, 0, -1),
    v(0, -1, 0),
    v(1, 1, 0),
    v(0.2, -0.3, 0.93),
    v(0.01, 0, -1),
  ];
  for (const normal of normals) {
    const origin = v(1, 2, 3);
    const b = computeFaceBasis(normal, origin);
    near(dot(b.u, b.u), 1, 1e-12);
    near(dot(b.v, b.v), 1, 1e-12);
    near(dot(b.u, b.v), 0, 1e-12);
    nearV(cross(b.u, b.v), b.n, 1e-12);
    const p = v(4, -2, 7);
    const back = unprojectPoint(projectPoint(p, b), b);
    // Round trip through the plane = projection of p onto the plane.
    const off = dot({ x: p.x - 1, y: p.y - 2, z: p.z - 3 }, b.n);
    nearV(
      back,
      { x: p.x - b.n.x * off, y: p.y - b.n.y * off, z: p.z - b.n.z * off },
      1e-12
    );
  }
  // Wall: v is the in-plane vertical.
  nearV(computeFaceBasis(v(0, -1, 0)).v, v(0, 0, 1), 1e-12);
});

test("faceOverlapArea: coplanar, offset planes, holes, disjoint", () => {
  const A = face(rect(0, 0, 4, 2), v(0, 0, 1));
  near(faceOverlapArea(A, face(rect(2, 0, 6, 2), v(0, 0, 1))), 4, 1e-6);
  // B 2 mm above A, wound the other way: still projected onto A's plane.
  const B = face([...rect(2, 0, 6, 2, 0.002)].reverse(), v(0, 0, 1));
  near(faceOverlapArea(A, B), 4, 1e-6);
  // A hole in B inside the overlap.
  const C = face(rect(2, 0, 6, 2), v(0, 0, 1), [rect(2.5, 0.5, 3.5, 1.5)]);
  near(faceOverlapArea(A, C), 3, 1e-6);
  near(faceOverlapArea(A, face(rect(5, 0, 6, 2), v(0, 0, 1))), 0, 1e-12);
  // Identical faces (coincident edges everywhere).
  near(faceOverlapArea(A, A), 8, 1e-6);
});

test("faceCentroid: L shape and off-center hole", () => {
  const L = face(
    [v(0, 0, 0), v(2, 0, 0), v(2, 1, 0), v(1, 1, 0), v(1, 2, 0), v(0, 2, 0)],
    v(0, 0, 1)
  );
  // Two unit squares at (1.5, 0.5) and (0.5, 0.5) + one at (0.5, 1.5).
  nearV(faceCentroid(L), v(5 / 6, 5 / 6, 0), 1e-12);
  const holed = face(rect(0, 0, 4, 2), v(0, 0, 1), [
    rect(3, 0.5, 4 - 0.01, 1.5),
  ]);
  const c = faceCentroid(holed);
  assert.ok(c.x < 2);
  near(c.y, 1, 1e-9);
});

test("orientFaceLoops / flipFace", () => {
  const raw = face([...rect(0, 0, 4, 3)].reverse(), v(0, 0, 3), [
    rect(1, 1, 2, 2),
  ]);
  const oriented = orientFaceLoops(raw);
  nearV(oriented.normal, v(0, 0, 1));
  assert.ok(
    dot(loopAreaVector(oriented.polygons[0].contour), oriented.normal) > 0
  );
  assert.ok(
    dot(loopAreaVector(oriented.polygons[0].holes[0]), oriented.normal) < 0
  );
  const flipped = flipFace(oriented);
  nearV(flipped.normal, v(0, 0, -1));
  assert.ok(
    dot(loopAreaVector(flipped.polygons[0].contour), flipped.normal) > 0
  );
  assert.ok(
    dot(loopAreaVector(flipped.polygons[0].holes[0]), flipped.normal) < 0
  );
  near(faceArea(flipped), 11);
});

test("localGeometryBox", () => {
  const box = localGeometryBox("EDGE", { points: [v(1, -2, 3), v(-1, 2, 0)] });
  assert.deepEqual(box, { min: v(-1, -2, 0), max: v(1, 2, 3) });
  assert.equal(localGeometryBox("FACE", { polygons: [] }), null);
});

test("maxVertexShift: symmetric nearest-vertex distance", () => {
  const A = face(rect(0, 0, 4, 3), v(0, 0, 1));
  near(maxVertexShift("FACE", A, A), 0);
  const B = face(rect(0, 0, 4, 3, 0.001), v(0, 0, 1));
  near(maxVertexShift("FACE", A, B), 0.001, 1e-12);
  // Loops starting at another vertex: same geometry.
  const rotated = face(
    [...rect(0, 0, 4, 3).slice(2), ...rect(0, 0, 4, 3).slice(0, 2)],
    v(0, 0, 1)
  );
  near(maxVertexShift("FACE", A, rotated), 0);
  // Structure changes.
  assert.equal(
    maxVertexShift("FACE", A, {
      polygons: [...A.polygons, ...A.polygons],
      normal: v(0, 0, 1),
    }),
    Infinity
  );
  assert.equal(
    maxVertexShift(
      "FACE",
      A,
      face(rect(0, 0, 4, 3), v(0, 0, 1), [rect(1, 1, 2, 2)])
    ),
    Infinity
  );
  assert.equal(maxVertexShift("FACE", A, flipFace(A)), Infinity);
  // Edges: direction ignored.
  const e1 = { points: [v(0, 0, 0), v(5, 0, 0)] };
  const e2 = { points: [v(5, 0.003, 0), v(0, 0, 0)] };
  near(maxVertexShift("EDGE", e1, e2), 0.003, 1e-12);
});
