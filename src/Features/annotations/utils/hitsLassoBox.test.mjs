import assert from "node:assert/strict";
import { test } from "node:test";

import hitsLassoBox from "./hitsLassoBox.js";
import {
  LASSO_MODE_CROSSING,
  LASSO_MODE_WINDOW,
} from "../../mapEditorGeneric/utils/lassoMode.js";

// Closed ring → edges (last → first included), like getAnnotationLassoSegments
// for a POLYGON.
const ringEdges = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);

const box = { x: 100, y: 100, width: 200, height: 200 }; // [100..300]²

const hits = (verts, edges, mode) =>
  hitsLassoBox({ verts, edges, selectionBox: box, mode });

test("fully enclosed polygon is caught in both modes", () => {
  const ring = [
    { x: 150, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ];
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_WINDOW), true);
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_CROSSING), true);
});

test("partially enclosed polygon (one vertex inside): CROSSING only", () => {
  const ring = [
    { x: 250, y: 250 },
    { x: 400, y: 250 },
    { x: 400, y: 400 },
    { x: 250, y: 400 },
  ];
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_WINDOW), false);
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_CROSSING), true);
});

test("segment crossing the box with no vertex inside: CROSSING only", () => {
  const verts = [
    { x: 0, y: 200 },
    { x: 500, y: 200 },
  ];
  const edges = [[verts[0], verts[1]]];
  assert.equal(hits(verts, edges, LASSO_MODE_WINDOW), false);
  assert.equal(hits(verts, edges, LASSO_MODE_CROSSING), true);
});

test("box drawn in the notch of a U, touching no edge: neither mode", () => {
  // U shape around the box: arms at x < 100 and x > 300, bottom at y > 300.
  const ring = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 350 },
    { x: 350, y: 350 },
    { x: 350, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 },
  ];
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_WINDOW), false);
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_CROSSING), false);
});

test("box entirely inside a large polygon, touching no edge: neither mode", () => {
  const ring = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 },
  ];
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_WINDOW), false);
  assert.equal(hits(ring, ringEdges(ring), LASSO_MODE_CROSSING), false);
});

test("single point (POINT / LABEL): inside in both modes, outside in none", () => {
  assert.equal(hits([{ x: 200, y: 200 }], [], LASSO_MODE_WINDOW), true);
  assert.equal(hits([{ x: 200, y: 200 }], [], LASSO_MODE_CROSSING), true);
  assert.equal(hits([{ x: 50, y: 200 }], [], LASSO_MODE_WINDOW), false);
  assert.equal(hits([{ x: 50, y: 200 }], [], LASSO_MODE_CROSSING), false);
});

test("edge touching a box side counts as crossing", () => {
  const verts = [
    { x: 50, y: 100 },
    { x: 350, y: 100 },
  ];
  assert.equal(hits(verts, [[verts[0], verts[1]]], LASSO_MODE_CROSSING), true);
});

test("no vertices → never hit", () => {
  assert.equal(hits([], [], LASSO_MODE_WINDOW), false);
  assert.equal(hits([], [], LASSO_MODE_CROSSING), false);
});
