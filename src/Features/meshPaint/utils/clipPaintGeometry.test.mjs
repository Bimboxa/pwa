// node --test src/Features/meshPaint/utils/clipPaintGeometry.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import clipPaintGeometry, { getClipKey } from "./clipPaintGeometry.js";
import { cylinderTriangles, v } from "./meshPaintTestFixtures.mjs";
import { matchPaintPartToIndex } from "./planPaintResync.js";

// Displayed half: y ≥ 0 (axis z through the origin).
const CLIP = { point: v(0, 0, 0), normal: v(0, 1, 0) };

// The displayed half of a cylinder plus its copy turned 180° about the axis
// (what getHostPartData reads from a half-view revolution).
function halfPlusTurned() {
  const half = cylinderTriangles({ segments: 16, sweep: Math.PI });
  const turned = [];
  for (let i = 0; i < half.length; i += 3) {
    turned.push(-half[i], -half[i + 1], half[i + 2]);
  }
  return [...half, ...turned];
}

test("a half-view host is one full-turn surface, drawn on its shown side", () => {
  const index = buildHostPartIndex({ triangles: halfPlusTurned() });
  assert.equal(index.islands.length, 32);
  const island = index.islands.find((i) => i.centroid.y > 0);
  const grown = matchPaintPartToIndex(
    "FACE",
    { polygons: island.polygons, normal: island.normal },
    index,
    { allowFar: false, smoothAngleDeg: 25 }
  );
  // The paint (and its quantity) covers the whole turn…
  assert.equal(grown.geometry.polygons.length, 32);
  // …only the displayed half is drawn.
  const shown = clipPaintGeometry("FACE", grown.geometry, CLIP);
  assert.equal(shown.polygons.length, 16);
  assert.ok(shown.polygons.every((p) => p.contour.some((q) => q.y > 0)));
  assert.equal(shown.curved, true);
  // The other view side shows the other half of the SAME geometry.
  const other = clipPaintGeometry("FACE", grown.geometry, {
    ...CLIP,
    normal: v(0, -1, 0),
  });
  assert.equal(other.polygons.length, 16);
  assert.equal(clipPaintGeometry("FACE", grown.geometry, null), grown.geometry);
});

test("edges: displayed segments only", () => {
  const points = [v(1, -1, 0), v(1, 0, 0), v(1, 1, 0), v(0, 2, 0)];
  assert.equal(clipPaintGeometry("EDGE", { points }, CLIP).segments.length, 2);
  assert.equal(clipPaintGeometry("EDGE", { points }, null).segments.length, 3);
  assert.equal(
    clipPaintGeometry("EDGE", { points: points.slice(0, 2) }, CLIP),
    null
  );
  assert.equal(getClipKey(null), "");
  assert.notEqual(getClipKey(CLIP), "");
});
