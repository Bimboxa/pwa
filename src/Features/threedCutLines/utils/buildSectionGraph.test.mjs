import assert from "node:assert/strict";
import { test } from "node:test";

import quantizeVertex from "../../threedDrawing/utils/quantizeVertex.js";
import buildSectionGraph, {
  locateNodeNear,
  locateOnGraph,
} from "./buildSectionGraph.js";
import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import { P, nearPoint, slab, wall } from "./cutLineFixtures.mjs";

const PLANE_X2 = { normal: P(1, 0, 0), constant: 2 };
const key = (x, y, z) => quantizeVertex(P(x, y, z));

function sceneGraph(triangles = [...slab(), ...wall()]) {
  return buildSectionGraph(sectionTrianglesByPlane(PLANE_X2, triangles));
}

test("(d) T-junction: the wall base becomes a node of the slab segment", () => {
  const graph = sceneGraph();
  const base = graph.nodes.get(key(2, 5, 0));
  assert.ok(base, "node (2,5,0) exists");

  // The slab segment (2,2)-(2,10) no longer exists as one edge: (2,2,0) now
  // leads to the wall base, not to the free edge.
  const slabNode = graph.nodes.get(key(2, 2, 0));
  const slabKeys = slabNode.neighbors.map((n) => n.key);
  assert.ok(
    slabKeys.includes(key(2, 5, 0)),
    "slab edge split at the wall base"
  );
  assert.ok(
    !slabKeys.includes(key(2, 10, 0)),
    "no direct edge to the free edge"
  );

  // The base joins the slab (both sides), the wall front face going up, and
  // the wall bottom (overlapping the slab).
  const baseKeys = base.neighbors.map((n) => n.key);
  assert.ok(baseKeys.includes(key(2, 2, 0)), "slab towards the start");
  assert.ok(
    base.neighbors.some((n) => n.key.endsWith("_0") && n.normal.z > 0.9),
    "slab (+z) continues under the wall"
  );
  assert.ok(
    base.neighbors.some((n) => n.normal.y < -0.9),
    "wall front face (-y) leaves the base"
  );
  assert.ok(
    base.neighbors.some((n) => n.normal.z < -0.9),
    "wall bottom (-z) overlaps the slab: doubled edge"
  );
});

test("doubled collinear edges: same neighbor key listed twice with each triangle's normal", () => {
  const graph = sceneGraph();
  // Under the wall, the slab (+z) and the wall bottom (-z) share the same
  // sub-segment.
  const base = graph.nodes.get(key(2, 5, 0));
  const under = base.neighbors.filter(
    (n) => n.key !== key(2, 2, 0) && n.key.endsWith("_0")
  );
  assert.equal(under.length, 2);
  assert.equal(under[0].key, under[1].key);
  const zs = under.map((n) => n.normal.z).sort((p, q) => p - q);
  nearPoint(P(zs[0], 0, zs[1]), P(-1, 0, 1));
});

test("keys are 1 mm quantized: endpoints closer than 1 mm collapse into one node", () => {
  const graph = buildSectionGraph([
    { a: P(0, 0, 0), b: P(1, 0, 0), normal: P(0, 0, 1) },
    { a: P(1.0003, 0, 0), b: P(2, 0, 0), normal: P(0, 0, 1) },
  ]);
  assert.equal(graph.nodes.size, 3);
  assert.equal(graph.nodes.get(key(1, 0, 0)).neighbors.length, 2);
});

test("locateOnGraph inserts the point on the nearest parallel edge and splits it", () => {
  const graph = sceneGraph(slab());
  const k = locateOnGraph(graph, P(2, 1, 0), P(0, -1, 0));
  assert.equal(k, key(2, 1, 0));
  const node = graph.nodes.get(k);
  nearPoint(node.position, P(2, 1, 0));
  const keys = node.neighbors.map((n) => n.key).sort();
  assert.deepEqual(keys, [key(2, 0, 0), key(2, 2, 0)].sort());
  // The old edge (2,0)-(2,2) is gone from both endpoints.
  assert.ok(
    !graph.nodes.get(key(2, 0, 0)).neighbors.some((n) => n.key === key(2, 2, 0))
  );
  assert.ok(
    !graph.nodes.get(key(2, 2, 0)).neighbors.some((n) => n.key === key(2, 0, 0))
  );
  // Direction sign does not matter.
  assert.equal(locateOnGraph(graph, P(2, 1.5, 0), P(0, 1, 0)), key(2, 1.5, 0));
});

test("locateOnGraph: a point on an existing node returns that node without splitting", () => {
  const graph = sceneGraph(slab());
  assert.equal(locateOnGraph(graph, P(2, 2.0004, 0), P(0, 1, 0)), key(2, 2, 0));
  assert.equal(graph.nodes.size, 3);
});

test("locateOnGraph: no parallel edge within tolerance × 10 → null", () => {
  const graph = sceneGraph(slab());
  // Perpendicular direction.
  assert.equal(locateOnGraph(graph, P(2, 1, 0), P(1, 0, 0)), null);
  // Too far from the section line.
  assert.equal(locateOnGraph(graph, P(2, 1, 0.02), P(0, 1, 0)), null);
  // Within 10 mm: accepted, projected onto the edge.
  const k = locateOnGraph(graph, P(2, 1, 0.005), P(0, 1, 0));
  nearPoint(graph.nodes.get(k).position, P(2, 1, 0));
});

test("locateOnGraph splits doubled edges together, keeping each normal", () => {
  const graph = sceneGraph();
  // Under the wall: slab (+z) and wall bottom (-z) overlap on (2,5)-(2,5.04).
  const k = locateOnGraph(graph, P(2, 5.02, 0), P(0, 1, 0));
  const node = graph.nodes.get(k);
  const toBase = node.neighbors.filter((n) => n.key === key(2, 5, 0));
  assert.equal(toBase.length, 2);
  const zs = toBase.map((n) => n.normal.z).sort((p, q) => p - q);
  nearPoint(P(zs[0], 0, zs[1]), P(-1, 0, 1));
});

test("locateNodeNear: the closest existing node within the distance, else null", () => {
  const graph = sceneGraph();
  assert.equal(locateNodeNear(graph, P(2, 5.004, 0), 1e-2), key(2, 5, 0));
  assert.equal(locateNodeNear(graph, P(2, 5.17, 0), 1e-2), null);
  assert.equal(locateNodeNear(graph, P(2, 5.17, 0), 0.05), key(2, 5.2, 0));
  assert.equal(locateNodeNear(null, P(2, 5, 0)), null);
});
