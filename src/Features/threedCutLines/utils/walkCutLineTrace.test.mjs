import assert from "node:assert/strict";
import { test } from "node:test";

import quantizeVertex from "../../threedDrawing/utils/quantizeVertex.js";
import buildSectionGraph, { locateOnGraph } from "./buildSectionGraph.js";
import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import walkCutLineTrace from "./walkCutLineTrace.js";
import {
  P,
  curvedSheet,
  nearPoints,
  sheet,
  slab,
  wall,
} from "./cutLineFixtures.mjs";

const PLANE_X2 = { normal: P(1, 0, 0), constant: 2 };
const UP = P(0, 0, 1);

function graphOf(triangles) {
  return buildSectionGraph(sectionTrianglesByPlane(PLANE_X2, triangles));
}

function walkFrom(triangles, point, direction, faceNormal, opts = {}) {
  const graph = graphOf(triangles);
  const startKey = locateOnGraph(graph, point, direction);
  assert.ok(startKey, "start located on the graph");
  return walkCutLineTrace(graph, { startKey, direction, faceNormal, ...opts });
}

test("(a) slab + wall: climbs the wall (concave), crosses the top (convex), comes down and stops at the free edge", () => {
  const points = walkFrom([...slab(), ...wall()], P(2, 3, 0), P(0, 1, 0), UP);
  nearPoints(points, [
    P(2, 5, 0),
    P(2, 5, 3),
    P(2, 5.2, 3),
    P(2, 5.2, 0),
    P(2, 10, 0),
  ]);
});

test("(b) slab alone: stops at the free edge, one point", () => {
  nearPoints(walkFrom(slab(), P(2, 3, 0), P(0, 1, 0), UP), [P(2, 10, 0)]);
  nearPoints(walkFrom(slab(), P(2, 3, 0), P(0, -1, 0), UP), [P(2, 0, 0)]);
});

test("(c) closed box: goes round and stops on the visited start, no infinite loop", () => {
  const points = walkFrom(wall(), P(2, 5.1, 3), P(0, -1, 0), UP);
  assert.ok(points.length <= 64);
  nearPoints(points, [P(2, 5, 3), P(2, 5, 0), P(2, 5.2, 0), P(2, 5.2, 3)]);
});

test("(f) simplification: an 8-triangle slab yields no intermediate vertex", () => {
  const graph = graphOf(slab({ grid: 2 }));
  // The x = 2 line crosses cell diagonals and the y = 5 cell boundary: the
  // raw section has several nodes between the start and the free edge.
  assert.ok(graph.nodes.size > 3, `raw nodes: ${graph.nodes.size}`);
  const startKey = locateOnGraph(graph, P(2, 3, 0), P(0, 1, 0));
  const points = walkCutLineTrace(graph, {
    startKey,
    direction: P(0, 1, 0),
    faceNormal: UP,
  });
  nearPoints(points, [P(2, 10, 0)]);
});

test("maxPoints caps the SIMPLIFIED points: the first two corners of the full trace", () => {
  const points = walkFrom([...slab(), ...wall()], P(2, 3, 0), P(0, 1, 0), UP, {
    maxPoints: 2,
  });
  nearPoints(points, [P(2, 5, 0), P(2, 5, 3)]);
});

test("maxRawPoints caps the raw walk before simplification", () => {
  const points = walkFrom([...slab(), ...wall()], P(2, 3, 0), P(0, 1, 0), UP, {
    maxRawPoints: 2,
  });
  // Two raw steps: the wall base, then the first node up the wall front face
  // (the face diagonal cuts it) — simplification keeps the corner and the
  // last point.
  assert.equal(points.length, 2);
  nearPoints([points[0]], [P(2, 5, 0)]);
  assert.ok(points[1].z > 0 && points[1].z <= 3);
});

test("a curved sheet of more than 64 raw nodes is walked to its top under the simplified cap", () => {
  const triangles = curvedSheet();
  const graph = graphOf(triangles);
  assert.ok(graph.nodes.size > 64, `raw nodes: ${graph.nodes.size}`);
  const points = walkCutLineTrace(graph, {
    startKey: quantizeVertex(P(2, 5, 0)),
    direction: P(0, 1, 0),
    faceNormal: UP,
    allowPerpendicularStart: true,
  });
  assert.ok(
    points.length > 10 && points.length <= 64,
    `points: ${points.length}`
  );
  const top = points[points.length - 1];
  assert.ok(Math.abs(top.z - 6) < 1e-6 && Math.abs(top.y - 11) < 1e-6);
});

test("allowPerpendicularStart: a first step straight up the sheet is taken only with the option", () => {
  const graph = graphOf(sheet());
  const startKey = quantizeVertex(P(2, 5, 0));
  assert.ok(graph.nodes.has(startKey));
  const base = { startKey, direction: P(0, 1, 0), faceNormal: UP };
  nearPoints(walkCutLineTrace(graph, base), []);
  nearPoints(
    walkCutLineTrace(graph, { ...base, allowPerpendicularStart: true }),
    [P(2, 5, 3)]
  );
});

test("a shared visited set stops a second walk at nodes the first one took", () => {
  const graph = graphOf(wall());
  const visited = new Set();
  const k1 = locateOnGraph(graph, P(2, 5.05, 3), P(0, -1, 0));
  const k2 = locateOnGraph(graph, P(2, 5.1, 3), P(0, 1, 0));
  visited.add(k1);
  visited.add(k2);
  const first = walkCutLineTrace(graph, {
    startKey: k1,
    direction: P(0, -1, 0),
    faceNormal: UP,
    visited,
  });
  nearPoints(first, [P(2, 5, 3), P(2, 5, 0), P(2, 5.2, 0), P(2, 5.2, 3)]);
  const second = walkCutLineTrace(graph, {
    startKey: k2,
    direction: P(0, 1, 0),
    faceNormal: UP,
    visited,
  });
  assert.deepEqual(second, []);
  assert.ok(visited.has(quantizeVertex(P(2, 5.2, 3))));
});

test("unknown start or degenerate inputs: empty trace", () => {
  const graph = graphOf(slab());
  assert.deepEqual(
    walkCutLineTrace(graph, {
      startKey: "nope",
      direction: P(0, 1, 0),
      faceNormal: UP,
    }),
    []
  );
  const startKey = locateOnGraph(graph, P(2, 3, 0), P(0, 1, 0));
  assert.deepEqual(
    walkCutLineTrace(graph, {
      startKey,
      direction: P(0, 0, 0),
      faceNormal: UP,
    }),
    []
  );
  // Face normal parallel to the direction: no cutting plane.
  assert.deepEqual(
    walkCutLineTrace(graph, {
      startKey,
      direction: P(0, 1, 0),
      faceNormal: P(0, 1, 0),
    }),
    []
  );
});
