import assert from "node:assert/strict";
import { test } from "node:test";

import { Vector3 } from "three";

import quantizeVertex from "../../threedDrawing/utils/quantizeVertex.js";

import extendCollinearEdge from "./extendCollinearEdge.js";
import { nearV, v } from "./meshPaintTestFixtures.mjs";

// Feature-edge graph shaped like useVertexSnap.buildIndex's adjacency:
// Map<quantizeVertex key, {position: Vector3, neighbors: Set<key>, nodeIds}>.
function graph(segments) {
  const adjacency = new Map();
  const node = (p) => {
    const key = quantizeVertex(p);
    if (!adjacency.has(key)) {
      adjacency.set(key, {
        position: new Vector3(p.x, p.y, p.z),
        neighbors: new Set(),
        nodeIds: new Set(["host"]),
      });
    }
    return key;
  };
  for (const [a, b] of segments) {
    const ka = node(a);
    const kb = node(b);
    adjacency.get(ka).neighbors.add(kb);
    adjacency.get(kb).neighbors.add(ka);
  }
  return adjacency;
}
const key = (p) => quantizeVertex(p);

// Wall base y = 0 cut in 3 pieces (thin-wall quads / T-junctions), corners
// at both ends going up and back; a jamb branching off the middle.
const P = [v(0, 0, 0), v(1.5, 0, 0), v(3, 0, 0), v(5, 0, 0)];
const segments = [
  [P[0], P[1]],
  [P[1], P[2]],
  [P[2], P[3]],
  [P[0], v(0, 0, 2.5)], // corner up
  [P[3], v(5, 0.2, 0)], // corner back
  [P[1], v(1.5, 0, 2.1)], // jamb on the middle vertex (T)
];

test("extendCollinearEdge: middle piece grows to the whole straight edge", () => {
  const adjacency = graph(segments);
  const edge = extendCollinearEdge(adjacency, key(P[1]), key(P[2]));
  nearV(edge.a, P[0]);
  nearV(edge.b, P[3]);
  // Either orientation of the picked piece.
  const reversed = extendCollinearEdge(adjacency, key(P[2]), key(P[1]));
  nearV(reversed.a, P[3]);
  nearV(reversed.b, P[0]);
});

test("extendCollinearEdge: corners stop the walk, overlapping pieces too", () => {
  const adjacency = graph([
    ...segments,
    [P[0], P[2]], // overlapping long piece (T-junction other side)
  ]);
  const edge = extendCollinearEdge(adjacency, key(P[0]), key(v(0, 0, 2.5)));
  nearV(edge.a, P[0]);
  nearV(edge.b, v(0, 0, 2.5));
  const base = extendCollinearEdge(adjacency, key(P[0]), key(P[1]));
  nearV(base.a, P[0]);
  nearV(base.b, P[3]);
});

test("extendCollinearEdge: a sampled arc does not drift into a line", () => {
  // 0.3° turn per 0.5 m step: the next piece is 0.3° off the picked one
  // (kept), the one after 0.6° (> EDGE_COLLINEAR_DEG): the walk stops.
  const points = [v(0, 0, 0)];
  let angle = 0;
  for (let i = 0; i < 6; i++) {
    const last = points[points.length - 1];
    points.push(
      v(last.x + 0.5 * Math.cos(angle), last.y + 0.5 * Math.sin(angle), 0)
    );
    angle += (0.3 * Math.PI) / 180;
  }
  const adjacency = graph(points.slice(1).map((p, i) => [points[i], p]));
  const edge = extendCollinearEdge(adjacency, key(points[0]), key(points[1]));
  nearV(edge.a, points[0]);
  nearV(edge.b, points[2]);
});

test("extendCollinearEdge: plain-object adjacency, unknown keys", () => {
  const adjacency = {};
  for (const [k, entry] of graph(segments)) {
    adjacency[k] = {
      position: {
        x: entry.position.x,
        y: entry.position.y,
        z: entry.position.z,
      },
      neighbors: [...entry.neighbors],
    };
  }
  const edge = extendCollinearEdge(adjacency, key(P[2]), key(P[3]));
  nearV(edge.a, P[0]);
  nearV(edge.b, P[3]);
  assert.equal(extendCollinearEdge(adjacency, "nope", key(P[3])), null);
  assert.equal(extendCollinearEdge(adjacency, key(P[3]), key(P[3])), null);
});
