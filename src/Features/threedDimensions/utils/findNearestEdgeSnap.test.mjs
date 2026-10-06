import assert from "node:assert/strict";
import { test } from "node:test";

import { PerspectiveCamera, Vector2, Vector3 } from "three";

import findNearestEdgeSnap from "./findNearestEdgeSnap.js";

const canvasSize = { width: 1000, height: 800 };

// Perspective view looking down the -Z direction, slightly from above: an
// edge along Z runs away from the camera (strong depth variation).
const camera = new PerspectiveCamera(75, 1000 / 800, 0.1, 1000);
camera.position.set(1, 3, 2);
camera.lookAt(0, 0, -6);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

function adjacencyOfEdges(edges) {
  const adjacency = new Map();
  const node = (key, p) => {
    if (!adjacency.has(key)) {
      adjacency.set(key, {
        position: new Vector3(...p),
        neighbors: new Set(),
        nodeIds: new Set(["annotation"]),
      });
    }
    return adjacency.get(key);
  };
  for (const [a, b] of edges) {
    const ka = a.join(",");
    const kb = b.join(",");
    node(ka, a).neighbors.add(kb);
    node(kb, b).neighbors.add(ka);
  }
  return adjacency;
}

const toNdc = (world) => {
  const p = world.clone().project(camera);
  return new Vector2(p.x, p.y);
};

const screenGapPx = (world, ndc) => {
  const p = world.clone().project(camera);
  return Math.hypot(
    ((p.x - ndc.x) * canvasSize.width) / 2,
    ((p.y - ndc.y) * canvasSize.height) / 2
  );
};

test("a point on a receding edge stays under the cursor (perspective)", () => {
  const a = new Vector3(0, 0, 0);
  const b = new Vector3(0, 0, -20);
  const adjacency = adjacencyOfEdges([[a.toArray(), b.toArray()]]);

  for (const s of [0.1, 0.3, 0.5, 0.8]) {
    const target = a.clone().lerp(b, s);
    const ndc = toNdc(target);
    const snap = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize);
    assert.ok(snap, `snap at s=${s}`);
    assert.ok(
      snap.position.distanceTo(target) < 1e-6,
      `s=${s}: ${snap.position.toArray()} vs ${target.toArray()}`
    );
    assert.ok(screenGapPx(snap.position, ndc) < 1e-3);
  }
});

test("returns the snapped edge and its owning annotation", () => {
  const adjacency = adjacencyOfEdges([
    [
      [0, 0, 0],
      [0, 0, -20],
    ],
  ]);
  const ndc = toNdc(new Vector3(0, 0, -5));
  const snap = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize);
  assert.equal(snap.kind, "EDGE");
  assert.equal(snap.nodeId, "annotation");
  // Either orientation (adjacency iteration order).
  assert.deepEqual(
    snap.edge.map((p) => p.z).sort((u, v) => u - v),
    [-20, 0]
  );
});

test("an edge refused by `accept` gives way to the next closest one", () => {
  // Two parallel edges a few cm apart on screen; the cursor sits on the
  // first one.
  const near = [
    [0, 0, 0],
    [0, 0, -20],
  ];
  const other = [
    [0.03, 0, 0],
    [0.03, 0, -20],
  ];
  const adjacency = adjacencyOfEdges([near, other]);
  const ndc = toNdc(new Vector3(0, 0, -4));

  const free = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize);
  assert.ok(Math.abs(free.position.x) < 1e-9);

  const filtered = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize, 12, {
    accept: (p) => p.x > 0.01,
  });
  assert.ok(filtered, "the other edge is still within reach");
  assert.ok(Math.abs(filtered.position.x - 0.03) < 1e-9);

  const none = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize, 12, {
    accept: () => false,
  });
  assert.equal(none, null);
});

test("an edge running past the camera is clipped, not dropped", () => {
  // Along the view direction, from well in front of the camera to behind it:
  // the camera sits at (1, 3, 2) looking towards (0, 0, -6).
  const front = new Vector3(0, 0, -6);
  const behind = new Vector3(4, 6, 10);
  const adjacency = adjacencyOfEdges([[front.toArray(), behind.toArray()]]);

  const target = front.clone().lerp(behind, 0.2);
  const ndc = toNdc(target);
  const snap = findNearestEdgeSnap(adjacency, ndc, camera, canvasSize);
  assert.ok(snap, "the visible part of the edge is a snap target");
  assert.ok(
    snap.position.distanceTo(target) < 1e-6,
    `${snap.position.toArray()} vs ${target.toArray()}`
  );
  assert.ok(screenGapPx(snap.position, ndc) < 1e-3);

  // Entirely behind the camera: nothing to snap on.
  const back = adjacencyOfEdges([
    [
      [4, 6, 10],
      [5, 7, 12],
    ],
  ]);
  assert.equal(findNearestEdgeSnap(back, ndc, camera, canvasSize), null);
});
