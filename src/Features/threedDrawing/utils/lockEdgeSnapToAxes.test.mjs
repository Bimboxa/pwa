import assert from "node:assert/strict";
import { test } from "node:test";

import { OrthographicCamera, Vector3 } from "three";

import getEdgeSnapFrame from "./getEdgeSnapFrame.js";
import lockEdgeSnapToAxes from "./lockEdgeSnapToAxes.js";

// Top view of the XZ plane: 10 m across a 1000 px canvas -> 100 px / m.
const canvasSize = { width: 1000, height: 1000 };
const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
camera.position.set(0, 10, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

const v = (x, y, z) => new Vector3(x, y, z);

// Cross through `position`: axis A along X, axis B along Z (ground plane).
function crossAt(position, dirA = X, dirB = Z) {
  const arm = (dir) => [
    position.clone().addScaledVector(dir, -5),
    position.clone().addScaledVector(dir, 5),
  ];
  return { axisA: arm(dirA), axisB: arm(dirB) };
}

function adjacencyOf(...points) {
  return new Map(
    points.map(([x, y, z], i) => [`n${i}`, { position: v(x, y, z) }])
  );
}

const lock = (args) =>
  lockEdgeSnapToAxes({
    camera,
    canvasSize,
    ...crossAt(args.position),
    ...args,
  });

const near = (actual, expected) =>
  assert.ok(
    actual.distanceTo(expected) < 1e-6,
    `${actual.toArray()} ~ ${expected.toArray()}`
  );

// Right edge of a top face, the last vertex on its left edge.
const RIGHT_EDGE = [v(4, 0, -3), v(4, 0, 3)];
const LAST = { x: 0, y: 0, z: 0 };

test("stops on the ortho from the last vertex (arm along the segment)", () => {
  const snap = lock({
    edge: RIGHT_EDGE,
    position: v(4, 0, 0.1), // 10 px away along the edge
    lastVertex: LAST,
  });
  assert.ok(snap);
  near(snap.position, v(4, 0, 0));
  assert.equal(snap.axis, "A");
  assert.deepEqual(snap.lockedAxes, { A: true, B: false });
  assert.deepEqual(snap.alignFrom, []);
  // The cross follows the locked point.
  near(snap.axisA[0], v(-1, 0, 0));
  near(snap.axisB[0], v(4, 0, -5));
});

test("no ortho lock outside its 20 px corridor", () => {
  const snap = lock({
    edge: RIGHT_EDGE,
    position: v(4, 0, 0.3),
    lastVertex: LAST,
  });
  assert.equal(snap, null);
});

test("aligns with another vertex (marker on it)", () => {
  const snap = lock({
    edge: RIGHT_EDGE,
    position: v(4, 0, 1.03), // 3 px away along the edge
    lastVertex: LAST,
    adjacency: adjacencyOf([1, 2, 1]), // off-plane: aligns by footprint
  });
  assert.ok(snap);
  near(snap.position, v(4, 0, 1));
  assert.deepEqual(snap.lockedAxes, { A: true, B: false });
  assert.equal(snap.alignFrom.length, 1);
  near(snap.alignFrom[0].position, v(1, 2, 1));
  near(snap.alignFrom[0].footprint, v(1, 0, 1));
});

test("an edge along a lock direction only locks on the other arm", () => {
  // Edge along X: sliding along it never changes the X-arm coordinate; the
  // ortho from the last vertex is the perpendicular foot (segment along Z).
  const snap = lock({
    edge: [v(-1, 0, 2), v(5, 0, 2)],
    position: v(0.1, 0, 2),
    lastVertex: LAST,
  });
  assert.ok(snap);
  near(snap.position, v(0, 0, 2));
  assert.deepEqual(snap.lockedAxes, { A: false, B: true });
});

test("a last vertex lying on the edge gives no ortho lock", () => {
  const snap = lock({
    edge: [v(0, 0, -3), v(0, 0, 3)],
    position: v(0, 0, 0.1),
    lastVertex: LAST,
  });
  assert.equal(snap, null);
});

test("the edge's own ends never align (vertex snap zone)", () => {
  const snap = lock({
    edge: RIGHT_EDGE,
    position: v(4, 0, 2.95),
    adjacency: adjacencyOf([4, 0, -3], [4, 0, 3]),
  });
  assert.equal(snap, null);
});

// --- getEdgeSnapFrame ---------------------------------------------------

const dirOf = (axis) => axis[1].clone().sub(axis[0]).normalize();
const isParallel = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-9;

function groundHitAt(position) {
  return { position, baseMapId: "bm", ...crossAt(position) };
}

test("frame: the hovered plane holding the edge and the last vertex", () => {
  const position = v(4, 0, 0.5);
  const frame = getEdgeSnapFrame({
    planeHit: groundHitAt(v(3.95, 0, 0.5)),
    edge: RIGHT_EDGE,
    position,
    lastVertex: LAST,
  });
  assert.ok(frame);
  assert.ok(isParallel(dirOf(frame.axisA), X));
  assert.ok(isParallel(dirOf(frame.axisB), Z));
  // Translated through the edge point.
  near(frame.axisA[0], v(-1, 0, 0.5));
});

test("frame: cursor slipped onto the side face keeps the top plane", () => {
  // Side face x = 4 (normal +X); the last vertex is on the top plane y = 0.
  const sideHit = {
    position: v(4, -0.05, 0.5),
    normal: X.clone(),
    isFace: true,
    ...crossAt(v(4, -0.05, 0.5), Z, Y),
  };
  const frame = getEdgeSnapFrame({
    planeHit: sideHit,
    edge: RIGHT_EDGE,
    position: v(4, 0, 0.5),
    lastVertex: LAST,
  });
  assert.ok(frame);
  const normal = dirOf(frame.axisA).cross(dirOf(frame.axisB));
  assert.ok(isParallel(normal, Y), "frame lies in the top plane");
});

test("frame: none without a last vertex nor a usable plane", () => {
  assert.equal(
    getEdgeSnapFrame({
      planeHit: null,
      edge: RIGHT_EDGE,
      position: v(4, 0, 0.5),
      lastVertex: null,
    }),
    null
  );
  // A scan surface is not a plane.
  assert.equal(
    getEdgeSnapFrame({
      planeHit: { ...groundHitAt(v(4, 0, 0.5)), isScan: true },
      edge: RIGHT_EDGE,
      position: v(4, 0, 0.5),
      lastVertex: null,
    }),
    null
  );
});
