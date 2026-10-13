// node --test src/Features/meshPaint/utils/buildPaintFacetEdges.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import buildPaintFacetEdges from "./buildPaintFacetEdges.js";
import { near, v } from "./meshPaintTestFixtures.mjs";

// Two unit quads side by side in the z = 0 plane, sharing the edge x = 1.
const QUAD_A = { contour: [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)] };
const QUAD_B = { contour: [v(1, 0, 0), v(2, 0, 0), v(2, 1, 0), v(1, 1, 0)] };

test("a curved face draws every facet boundary, shared seams once", () => {
  const positions = buildPaintFacetEdges({
    curved: true,
    polygons: [QUAD_A, QUAD_B],
  });
  // 4 + 4 edges, the seam x = 1 counted once → 7 segments.
  assert.equal(positions.length, 7 * 6);
});

test("a flat face has no grid helper", () => {
  const positions = buildPaintFacetEdges({
    curved: false,
    polygons: [QUAD_A],
    normal: v(0, 0, 1),
  });
  assert.equal(positions.length, 0);
});

test("holes are traced and the lift follows the facet normal", () => {
  const hole = [
    v(0.25, 0.25, 0),
    v(0.25, 0.75, 0),
    v(0.75, 0.75, 0),
    v(0.75, 0.25, 0),
  ];
  const positions = buildPaintFacetEdges(
    { curved: true, polygons: [{ ...QUAD_A, holes: [hole] }] },
    { lift: 0.01 }
  );
  assert.equal(positions.length, 8 * 6);
  // QUAD_A is wound CCW about +z: every vertex is lifted by +0.01 in z.
  for (let i = 2; i < positions.length; i += 3) near(positions[i], 0.01);
});
