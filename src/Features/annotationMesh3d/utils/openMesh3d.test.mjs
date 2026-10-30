import assert from "node:assert/strict";
import { test } from "node:test";

import buildRibbonMesh3d from "./buildRibbonMesh3d.js";
import isMesh3dClosed, { isMesh3dOriented } from "./isMesh3dClosed.js";
import projectMesh3dToRings from "./projectMesh3dToRings.js";
import splitMesh3dFace from "./splitMesh3dFace.js";

// Open surfaces (a PX polyline wall swept by « Extruder »: one quad per
// segment) edited by the face cut / the part deletion, and their plan
// projection.

const v = (x, y, z) => ({ x, y, z });
const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

// Closed rectangular wall ring (4 vertical quads), 4 × 2 m, 3 m high.
const ring = () =>
  buildRibbonMesh3d({
    points: [v(0, 0, 0), v(4, 0, 0), v(4, 2, 0), v(0, 2, 0)],
    direction: v(0, 0, 1),
    distance: 3,
    closeLine: true,
  });

// Open L-shaped wall (2 vertical quads).
const chain = () =>
  buildRibbonMesh3d({
    points: [v(0, 0, 0), v(4, 0, 0), v(4, 2, 0)],
    direction: v(0, 0, 1),
    distance: 3,
  });

const bbox = (points) => ({
  minX: Math.min(...points.map((p) => p.x)),
  maxX: Math.max(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)),
  maxY: Math.max(...points.map((p) => p.y)),
});

test("a swept ribbon is oriented but open; a solid is both", () => {
  for (const mesh of [ring(), chain()]) {
    assert.equal(isMesh3dOriented(mesh), true);
    assert.equal(isMesh3dClosed(mesh), false);
  }
  const sheet = ring();
  sheet.faces.push({ loop: [0, 3, 2, 1], holes: [] }); // bottom cap
  sheet.faces.push({ loop: [4, 5, 6, 7], holes: [] }); // top cap
  assert.equal(isMesh3dClosed(sheet), true);
  assert.equal(isMesh3dOriented(sheet), true);
});

test("two faces running a shared edge the same way are not oriented", () => {
  const mesh = {
    vertices: [
      v(0, 0, 0),
      v(1, 0, 0),
      v(1, 0, 1),
      v(0, 0, 1),
      v(2, 0, 0),
      v(2, 0, 1),
    ],
    faces: [
      { loop: [0, 1, 2, 3], holes: [] },
      { loop: [1, 2, 5, 4], holes: [] }, // runs 1→2 like the first quad
    ],
  };
  assert.equal(isMesh3dOriented(mesh), false);
  mesh.faces[1] = { loop: [1, 4, 5, 2], holes: [] };
  assert.equal(isMesh3dOriented(mesh), true);
});

test("a ring of walls projects as a thin closed band, not a diagonal", () => {
  const rings = projectMesh3dToRings(ring());
  assert.equal(rings.isSegment, false);
  assert.equal(rings.holes.length, 1);
  const outer = bbox(rings.contour);
  near(outer.minX, -0.0025, 1e-6);
  near(outer.maxX, 4.0025, 1e-6);
  near(outer.minY, -0.0025, 1e-6);
  near(outer.maxY, 2.0025, 1e-6);
  const inner = bbox(rings.holes[0]);
  near(inner.minX, 0.0025, 1e-6);
  near(inner.maxX, 3.9975, 1e-6);
  near(inner.minY, 0.0025, 1e-6);
  near(inner.maxY, 1.9975, 1e-6);
});

test("a chain of walls projects as a thin open band", () => {
  const rings = projectMesh3dToRings(chain());
  assert.equal(rings.isSegment, false);
  assert.equal(rings.holes.length, 0);
  const box = bbox(rings.contour);
  // Each wall widens sideways only: x = 0 and y = 2 are wall ends.
  near(box.minX, 0, 1e-6);
  near(box.maxX, 4.0025, 1e-6);
  near(box.minY, -0.0025, 1e-6);
  near(box.maxY, 2, 1e-6);
  // The band follows the L: the far corner (0, 2) is outside it.
  const corner = rings.contour.some((p) => p.x < 0.01 && p.y > 1.99);
  assert.equal(corner, false);
});

test("a single vertical face still projects as a segment quad", () => {
  const one = buildRibbonMesh3d({
    points: [v(0, 0, 0), v(4, 0, 0)],
    direction: v(0, 0, 1),
    distance: 3,
  });
  const rings = projectMesh3dToRings(one);
  assert.equal(rings.isSegment, true);
  assert.equal(rings.contour.length, 4);
});

test("a wall of the ring is cut edge to edge, or gets an inner loop", () => {
  const base = ring();
  // Vertical line on the y = 0 wall (face 0), bottom edge to top edge.
  const cut = splitMesh3dFace(base, [v(1, 0, 0), v(1, 0, 3)]);
  assert.ok(cut, "edge-to-edge cut");
  assert.equal(cut.faces.length, 5);
  assert.equal(isMesh3dOriented(cut), true);

  // Window-like loop inside the same wall: a new face and a hole.
  const loop = splitMesh3dFace(
    base,
    [v(1, 0, 1), v(2, 0, 1), v(2, 0, 2), v(1, 0, 2)],
    { closed: true }
  );
  assert.ok(loop, "inner loop");
  assert.equal(loop.faces.length, 5);
  assert.equal(loop.faces[0].holes.length, 1);
  assert.equal(isMesh3dOriented(loop), true);
  // The projection keeps the ring's footprint.
  const rings = projectMesh3dToRings(loop);
  assert.equal(rings.holes.length, 1);
});
