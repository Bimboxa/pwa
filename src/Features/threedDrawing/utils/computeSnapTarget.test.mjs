import assert from "node:assert/strict";
import { test } from "node:test";

import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

import buildUserAxesPlaneHit from "./buildUserAxesPlaneHit.js";
import computeSnapTarget from "./computeSnapTarget.js";

// Top view of the XZ plane: 10 m across a 1000 px canvas -> 100 px / m.
const canvasSize = { width: 1000, height: 1000 };
const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
camera.position.set(0, 10, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

// User axes, yaw 0: X = world X, Y = world Z, Z = world Y (vertical).
const userAxes = [
  { key: "X", dir: new Vector3(1, 0, 0) },
  { key: "Y", dir: new Vector3(0, 0, 1) },
  { key: "Z", dir: new Vector3(0, 1, 0) },
];

// NDC of a ground point under the top view (x right, z down on screen).
const ndcOf = (x, z) => ({ x: x / 5, y: -z / 5 });

// Ground plane hit (a base map) under the cursor.
function groundHit(ndc) {
  const position = new Vector3(ndc.x * 5, 0, -ndc.y * 5);
  const arm = (dir) => [
    position.clone().addScaledVector(dir, -5),
    position.clone().addScaledVector(dir, 5),
  ];
  return {
    position,
    baseMapId: "bm",
    axisA: arm(new Vector3(1, 0, 0)),
    axisB: arm(new Vector3(0, 0, 1)),
  };
}

// Natural plane: horizontal through `through`, user axes for arms.
function naturalHit(through) {
  return (ndc) =>
    buildUserAxesPlaneHit(
      new Vector3(ndc.x * 5, through.y, -ndc.y * 5),
      { x: 0, y: 1, z: 0 },
      userAxes,
      { baseMapId: through.baseMapId ?? null }
    );
}

const noVertex = () => null;
const snapAt = (ndc, args) =>
  computeSnapTarget({
    mouseNdc: ndc,
    camera,
    canvasSize,
    inProgressPolyline: [],
    findNearestVertex: noVertex,
    axes: userAxes,
    ...args,
  });

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ~ ${expected}`);

test("off every surface, the natural plane takes the point", () => {
  const last = { x: 0, y: 1, z: 0, baseMapId: "bm" };
  const snap = snapAt(ndcOf(1.3, 2.1), {
    lastVertex: last,
    intersectPlane: () => null,
    intersectFallbackPlane: naturalHit(last),
  });
  assert.equal(snap.kind, "PLANE");
  assert.equal(snap.isNatural, true);
  assert.equal(snap.baseMapId, "bm");
  near(snap.position.y, 1);
  near(snap.position.x, 1.3);
  assert.deepEqual(snap.axisKeys, { A: "X", B: "Y" });
});

test("on the natural plane, the ortho lock follows the user axes", () => {
  const last = { x: 0, y: 1, z: 0 };
  // 5 px off the X line through the last vertex.
  const snap = snapAt(ndcOf(2, 0.05), {
    lastVertex: last,
    intersectPlane: () => null,
    intersectFallbackPlane: naturalHit(last),
  });
  assert.equal(snap.kind, "PLANE_ORTHO");
  assert.equal(snap.isNatural, true);
  near(snap.position.z, 0);
  near(snap.position.x, 2);
});

test("a hovered plane beats the natural plane", () => {
  const last = { x: 0, y: 1, z: 0 };
  const snap = snapAt(ndcOf(1.3, 2.1), {
    lastVertex: last,
    intersectPlane: groundHit,
    intersectFallbackPlane: naturalHit(last),
  });
  assert.equal(snap.kind, "PLANE");
  assert.equal(snap.isNatural, undefined);
  near(snap.position.y, 0);
});

test("the axis lock is keyed by the user axes: vertical is Z", () => {
  // A perspective side view along world X (the axis lock casts a ray from
  // the camera position): the vertical axis line through the last vertex
  // is the screen's centre column.
  const side = new PerspectiveCamera(60, 1, 0.1, 100);
  side.position.set(10, 0, 0);
  side.lookAt(0, 0, 0);
  side.updateMatrixWorld(true);
  side.updateProjectionMatrix();
  const snap = computeSnapTarget({
    mouseNdc: { x: 0.01, y: 0.4 },
    camera: side,
    canvasSize,
    lastVertex: { x: 0, y: 0, z: 0 },
    inProgressPolyline: [],
    findNearestVertex: noVertex,
    intersectPlane: () => null,
    axes: userAxes,
  });
  assert.equal(snap.kind, "AXIS_Z");
  assert.equal(snap.axis, "Z");
  near(snap.position.x, 0);
  near(snap.position.z, 0);
});

test("a locked plane: an edge snap that left it falls through to the plane", () => {
  const lockedPlane = {
    point: new Vector3(0, 0, 0),
    normal: new Vector3(0, 1, 0),
  };
  const snap = snapAt(ndcOf(1, 1), {
    lastVertex: { x: 0, y: 0, z: 0 },
    intersectPlane: groundHit,
    lockedPlane,
    // An edge 0.5 m above the plane, right under the cursor.
    findNearestEdge: () => ({
      position: new Vector3(1, 0.5, 1),
      edge: [new Vector3(0, 0.5, 1), new Vector3(2, 0.5, 1)],
    }),
  });
  assert.ok(snap, "a target");
  assert.equal(snap.kind, "PLANE");
  near(snap.position.y, 0);
});

// An edge along X at z = 1 (ground level), midpoint (1, 0, 1); the finder
// returns the point of the edge under the cursor.
const edgeFinder =
  (y = 0) =>
  (ndc) => ({
    position: new Vector3(ndc.x * 5, y, 1),
    kind: "EDGE",
    edge: [new Vector3(0, y, 1), new Vector3(2, y, 1)],
    nodeId: "a1",
  });

test("close to the midpoint of an edge, the point lands on it", () => {
  // 8 px off the midpoint along the edge, 3 px off the edge.
  const snap = snapAt(ndcOf(1.08, 1.03), {
    intersectPlane: () => null,
    findNearestEdge: edgeFinder(),
  });
  assert.equal(snap.kind, "EDGE");
  assert.equal(snap.isMidpoint, true);
  assert.equal(snap.nodeId, "a1");
  near(snap.position.x, 1);
  near(snap.position.y, 0);
  near(snap.position.z, 1);
});

test("away from the midpoint, the point slides along the edge", () => {
  // 30 px off the midpoint.
  const snap = snapAt(ndcOf(1.3, 1), {
    intersectPlane: () => null,
    findNearestEdge: edgeFinder(),
  });
  assert.equal(snap.kind, "EDGE");
  assert.equal(snap.isMidpoint, undefined);
  near(snap.position.x, 1.3);
});

test("a midpoint hidden behind the surface under the cursor is no target", () => {
  // The edge runs 0.5 m under the ground plane the cursor is on.
  const snap = snapAt(ndcOf(1.05, 1), {
    intersectPlane: groundHit,
    findNearestEdge: edgeFinder(-0.5),
  });
  assert.equal(snap.isMidpoint, undefined);
  near(snap.position.x, 1.05);
});

test("without a fallback nor a surface: the camera-facing FREE plane", () => {
  const snap = snapAt(ndcOf(1, 1), {
    lastVertex: { x: 0, y: 2, z: 0 },
    intersectPlane: () => null,
  });
  assert.equal(snap.kind, "FREE");
  near(snap.position.y, 2);
});
