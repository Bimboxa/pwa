import assert from "node:assert/strict";
import { test } from "node:test";

import { OrthographicCamera, Vector3 } from "three";

import alignPlaneHitToVertices from "./alignPlaneHitToVertices.js";

// Top view of the XZ plane: 10 m across a 1000 px canvas -> 100 px / m.
const canvasSize = { width: 1000, height: 1000 };
const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
camera.position.set(0, 10, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

// Plane hit on the ground, axis A along X and axis B along Z.
function planeHitAt(x, z) {
  const position = new Vector3(x, 0, z);
  const arm = (dir) => [
    position.clone().addScaledVector(dir, -5),
    position.clone().addScaledVector(dir, 5),
  ];
  return { position, baseMapId: "bm", axisA: arm(X), axisB: arm(Z) };
}

function adjacencyOf(...points) {
  return new Map(
    points.map(([x, y, z], i) => [`n${i}`, { position: new Vector3(x, y, z) }])
  );
}

const align = (args) =>
  alignPlaneHitToVertices({ camera, canvasSize, ...args });

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ~ ${expected}`);

test("the point takes the coordinate of a distant vertex, that arm locks", () => {
  const adjacency = adjacencyOf([2, 0, 1]);

  // 3 px off the vertex's X: slides along A, the B arm runs through it.
  const alongB = align({ planeHit: planeHitAt(2.03, -1), adjacency });
  assert.equal(alongB.kind, "PLANE_ALIGN");
  assert.equal(alongB.axis, "B");
  assert.deepEqual(alongB.lockedAxes, { A: false, B: true });
  near(alongB.position.x, 2);
  near(alongB.position.z, -1);
  near(alongB.axisB[0].x, 2);
  assert.equal(alongB.alignFrom.length, 1);

  // 5 px off the vertex's Z: slides along B, the A arm runs through it.
  const alongA = align({ planeHit: planeHitAt(-1, 1.05), adjacency });
  assert.equal(alongA.axis, "A");
  assert.deepEqual(alongA.lockedAxes, { A: true, B: false });
  near(alongA.position.x, -1);
  near(alongA.position.z, 1);
});

test("nothing locks out of the threshold", () => {
  const adjacency = adjacencyOf([2, 0, 1]);
  assert.equal(align({ planeHit: planeHitAt(2.2, -1), adjacency }), null);
});

test("both arms lock at once, each on its own vertex", () => {
  const adjacency = adjacencyOf([2, 0, 1], [-1, 0, -2]);
  const snap = align({ planeHit: planeHitAt(2.03, -2.04), adjacency });
  assert.deepEqual(snap.lockedAxes, { A: true, B: true });
  near(snap.position.x, 2);
  near(snap.position.z, -2);
  assert.equal(snap.alignFrom.length, 2);
  // The tightest lock (3 px vs 4 px) names the snap.
  assert.equal(snap.axis, "B");
});

test("the points of the drawing in progress are candidates", () => {
  const snap = align({
    planeHit: planeHitAt(2.03, -1),
    adjacency: null,
    extraPoints: [{ x: 2, y: 0, z: 1 }],
  });
  near(snap.position.x, 2);
  assert.deepEqual(snap.lockedAxes, { A: false, B: true });
});

test("slideAxes restricts the move to the locked line", () => {
  const adjacency = adjacencyOf([2, 0, 3], [-3, 0, 1.05]);
  const planeHit = planeHitAt(2.03, 1);

  const free = align({ planeHit, adjacency });
  assert.deepEqual(free.lockedAxes, { A: true, B: true });

  const onLine = align({ planeHit, adjacency, slideAxes: ["A"] });
  assert.deepEqual(onLine.lockedAxes, { A: false, B: true });
  near(onLine.position.x, 2);
  near(onLine.position.z, 1);
});

test("a vertex (almost) under the cursor is left to the vertex snap", () => {
  const adjacency = adjacencyOf([2, 0, 1]);
  assert.equal(align({ planeHit: planeHitAt(2.03, 1.1), adjacency }), null);
});

test("an off-plane vertex aligns through its footprint", () => {
  const adjacency = adjacencyOf([2, 3, 1]);
  const snap = align({ planeHit: planeHitAt(2.03, -1), adjacency });
  near(snap.position.x, 2);
  near(snap.position.y, 0);
  near(snap.alignFrom[0].position.y, 3);
  near(snap.alignFrom[0].footprint.x, 2);
  near(snap.alignFrom[0].footprint.y, 0);
  near(snap.alignFrom[0].footprint.z, 1);
});

test("of collinear vertices, the nearest one carries the lock", () => {
  const adjacency = adjacencyOf([2, 0, 4], [2, 0, 1.5]);
  const snap = align({ planeHit: planeHitAt(2.03, -1), adjacency });
  near(snap.alignFrom[0].position.z, 1.5);
});
