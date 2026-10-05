// node --test src/Features/meshPaint/utils/buildHostPartIndex.curved.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import {
  boxTriangles,
  cylinderTriangles,
  near,
  v,
} from "./meshPaintTestFixtures.mjs";

const SEGMENTS = 32;
const sizes = (surfaces) =>
  surfaces.surfaces.map((s) => s.length).sort((a, b) => b - a);

test("closed cylinder: the wall is one smooth surface, the caps stay apart", () => {
  const index = buildHostPartIndex({
    triangles: cylinderTriangles({ segments: SEGMENTS, caps: true }),
  });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, SEGMENTS + 2);
  assert.deepEqual(sizes(index.getSurfaces(25)), [SEGMENTS, 1, 1]);
  // 360 / 32 = 11.25° between neighbors: below it nothing joins.
  assert.deepEqual(sizes(index.getSurfaces(10)).length, SEGMENTS + 2);
  assert.deepEqual(sizes(index.getSurfaces(0)).length, SEGMENTS + 2);
  assert.ok(index.getSurfaces(25).flipOfIsland.every((flip) => !flip));
  assert.equal(index.getSurfaces(25), index.getSurfaces(25));
});

test("open curved sheet: one surface with one orientation", () => {
  // Half a turn: the canonical island orientation flips along the way.
  const index = buildHostPartIndex({
    triangles: cylinderTriangles({ segments: 16, sweep: Math.PI }),
  });
  assert.equal(index.isClosed, false);
  const { surfaces, flipOfIsland } = index.getSurfaces(25);
  assert.equal(surfaces.length, 1);
  // Once flipped, every island normal points the same radial way.
  const radial = surfaces[0].map((i) => {
    const island = index.islands[i];
    const sign = flipOfIsland[i] ? -1 : 1;
    return (
      sign *
      (island.normal.x * island.centroid.x +
        island.normal.y * island.centroid.y)
    );
  });
  assert.ok(radial.every((r) => r > 0) || radial.every((r) => r < 0));
});

test("a box has no smooth surface at 25°", () => {
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(2, 1, 3)),
  });
  assert.deepEqual(sizes(index.getSurfaces(25)), [1, 1, 1, 1, 1, 1]);
  const { curves } = index.getCurves(25);
  assert.equal(curves.length, index.chains.length);
  assert.ok(curves.every((curve) => curve.points.length === 2));
});

test("closed cylinder: each rim is one closed planar curve", () => {
  const index = buildHostPartIndex({
    triangles: cylinderTriangles({ segments: SEGMENTS, caps: true }),
  });
  const { curves, curveOfChain } = index.getCurves(25);
  const rims = curves.filter((curve) => curve.points.length > 2);
  assert.equal(rims.length, 2);
  for (const rim of rims) {
    assert.equal(rim.points.length, SEGMENTS + 1);
    assert.deepEqual(rim.points[0], rim.points[SEGMENTS]);
    assert.equal(rim.chains.length, SEGMENTS);
    near(rim.length, 2 * SEGMENTS * 2 * Math.sin(Math.PI / SEGMENTS), 1e-9);
    assert.ok(rim.points.every((p) => p.z === rim.points[0].z));
    // The cap is the only facet bordering the whole rim.
    assert.equal(rim.sides.length, 1);
    near(Math.abs(rim.sides[0].z), 1, 1e-9);
  }
  // The vertical seams stay straight edges.
  assert.equal(curves.length, 2 + SEGMENTS);
  assert.ok(curveOfChain.every((id) => id >= 0));
  // Below the 11.25° turn: straight edges only.
  assert.ok(
    index.getCurves(10).curves.every((curve) => curve.points.length === 2)
  );
});

test("open arc sheet: top and bottom arcs are open curves", () => {
  const index = buildHostPartIndex({
    triangles: cylinderTriangles({ segments: 8, sweep: Math.PI / 2 }),
  });
  const arcs = index
    .getCurves(25)
    .curves.filter((curve) => curve.points.length > 2);
  assert.equal(arcs.length, 2);
  for (const arc of arcs) assert.equal(arc.points.length, 9);
});
