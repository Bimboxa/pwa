import assert from "node:assert/strict";
import { test } from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import listHostFaceParts from "./listHostFaceParts.js";
import { faceCentroid, getPolygonNormal } from "./meshPaintGeometry.js";
import {
  boxTriangles,
  cylinderTriangles,
  quadTriangles,
  v,
} from "./meshPaintTestFixtures.mjs";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Floor z = 0 (x 0..2, y 0..2) + wall x = 0 (y 0..2, z 0..2), sharing the
// edge x = 0, z = 0: an open folded sheet (an L).
const lSheet = (out = []) => {
  quadTriangles(v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0), out);
  quadTriangles(v(0, 0, 0), v(0, 2, 0), v(0, 2, 2), v(0, 0, 2), out);
  return out;
};

const floorFace = (normalZ) => ({
  polygons: [
    {
      contour:
        normalZ > 0
          ? [v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0)]
          : [v(0, 2, 0), v(2, 2, 0), v(2, 0, 0), v(0, 0, 0)],
      holes: [],
    },
  ],
  normal: v(0, 0, normalZ),
});

const partFacing = (parts, axis) =>
  parts.find((part) => Math.abs(dot(part.normal, axis)) > 0.99);

test("closed box: one outward part per face, the clicked one named", () => {
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(2, 1, 3), { flip: ["top", "left"] }),
  });
  const clickedFace = {
    polygons: [
      { contour: [v(0, 0, 3), v(2, 0, 3), v(2, 1, 3), v(0, 1, 3)], holes: [] },
    ],
    normal: v(0, 0, 1),
  };
  const { parts, clickedIndex, isClosed, tooMany } = listHostFaceParts(index, {
    clickedFace,
  });
  assert.equal(isClosed, true);
  assert.equal(tooMany, false);
  assert.equal(parts.length, 6);
  const center = v(1, 0.5, 1.5);
  for (const part of parts) {
    const c = faceCentroid(part);
    const out = v(c.x - center.x, c.y - center.y, c.z - center.z);
    assert.ok(dot(part.normal, out) > 0, "outward");
  }
  assert.ok(dot(parts[clickedIndex].normal, v(0, 0, 1)) > 0.99);
});

test("open sheet: the clicked side spreads over the folded sheet", () => {
  const index = buildHostPartIndex({ triangles: lSheet() });
  assert.equal(index.isClosed, false);

  // Top of the floor → the wall side facing the floor (+x).
  const up = listHostFaceParts(index, { clickedFace: floorFace(1) });
  assert.equal(up.parts.length, 2);
  assert.ok(up.parts[up.clickedIndex].normal.z > 0.99);
  assert.ok(partFacing(up.parts, v(1, 0, 0)).normal.x > 0.99);

  // Underside of the floor → the back of the wall (-x).
  const down = listHostFaceParts(index, { clickedFace: floorFace(-1) });
  assert.equal(down.parts.length, 2);
  assert.ok(down.parts[down.clickedIndex].normal.z < -0.99);
  assert.ok(partFacing(down.parts, v(1, 0, 0)).normal.x < -0.99);
});

test("open host: a sheet apart from the clicked one faces the viewer", () => {
  const triangles = lSheet();
  quadTriangles(v(5, 0, 4), v(7, 0, 4), v(7, 2, 4), v(5, 2, 4), triangles);
  const index = buildHostPartIndex({ triangles });
  const apart = (parts) =>
    parts.find((part) => Math.abs(faceCentroid(part).z - 4) < 1e-6);

  const fromAbove = listHostFaceParts(index, {
    clickedFace: floorFace(1),
    viewDir: v(0, 0, -1),
  });
  assert.equal(fromAbove.parts.length, 3);
  assert.ok(apart(fromAbove.parts).normal.z > 0.99);

  const fromBelow = listHostFaceParts(index, {
    clickedFace: floorFace(1),
    viewDir: v(0, 0, 1),
  });
  assert.ok(apart(fromBelow.parts).normal.z < -0.99);
});

test("smoothing angle: a curved sheet is one part, one side", () => {
  const triangles = cylinderTriangles({
    radius: 2,
    segments: 8,
    sweep: Math.PI / 2,
  });
  const index = buildHostPartIndex({ triangles });

  const facets = listHostFaceParts(index, { smoothAngleDeg: 0 });
  assert.equal(facets.parts.length, 8);

  // Seen from the axis (inside of the arc): every facet turns inward.
  const smooth = listHostFaceParts(index, {
    smoothAngleDeg: 30,
    viewDir: v(Math.SQRT1_2, Math.SQRT1_2, 0),
  });
  assert.equal(smooth.parts.length, 1);
  const [surface] = smooth.parts;
  assert.equal(surface.curved, true);
  assert.equal(surface.angleDeg, 30);
  assert.equal(surface.polygons.length, 8);
  for (const polygon of surface.polygons) {
    const n = getPolygonNormal(polygon);
    const c = faceCentroid({ polygons: [polygon], normal: n });
    assert.ok(dot(n, v(c.x, c.y, 0)) < 0, "inward");
  }
});

test("maxParts: a host with too many faces lists nothing", () => {
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(1, 1, 1)),
  });
  const result = listHostFaceParts(index, { maxParts: 5 });
  assert.equal(result.tooMany, true);
  assert.equal(result.parts.length, 0);
  assert.equal(listHostFaceParts(index, { maxParts: 6 }).parts.length, 6);
});
