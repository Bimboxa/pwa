import assert from "node:assert/strict";
import { test } from "node:test";

import findMeshPaintMatches from "./findMeshPaintMatches.js";
import {
  METRICS,
  storedEdge,
  storedFace,
  v,
} from "./meshPaintTestFixtures.mjs";
import planPaintToggle from "./planPaintToggle.js";

// Wall front y = 0 (x 0..4, z 0..2.5), its two sides.
const front = (y = 0, x0 = 0, x1 = 4) => [
  v(x0, y, 0),
  v(x1, y, 0),
  v(x1, y, 2.5),
  v(x0, y, 2.5),
];

const faceRow = (id, geometry, extra = {}) => ({
  id,
  partType: "FACE",
  baseMapId: "bm1",
  hostAnnotationId: "h1",
  annotationTemplateId: "t1",
  geometry,
  ...extra,
});
const edgeRow = (id, geometry, extra = {}) => ({
  id,
  partType: "EDGE",
  baseMapId: "bm1",
  hostAnnotationId: "h1",
  annotationTemplateId: "t1",
  geometry,
  ...extra,
});

const ids = (rows) => rows.map((row) => row.id);

test("FACE: same side matches, the other side of a sheet does not", () => {
  const minusY = faceRow("a", storedFace(front(), v(0, -1, 0)));
  const plusY = faceRow("b", storedFace(front(), v(0, 1, 0)));
  const candidate = {
    partType: "FACE",
    baseMapId: "bm1",
    hostAnnotationId: "h2", // another host: matching is per base map
    geometry: storedFace([...front()].reverse(), v(0, -1, 0)),
  };
  assert.deepEqual(
    ids(
      findMeshPaintMatches({
        candidate,
        rows: [minusY, plusY],
        metrics: METRICS,
      })
    ),
    ["a"]
  );
});

test("FACE: plane gap and overlap thresholds", () => {
  const candidate = faceRow("c", storedFace(front(), v(0, -1, 0)));
  const rows = [
    faceRow("gap2mm", storedFace(front(0.002), v(0, -1, 0))),
    faceRow("gap5mm", storedFace(front(0.005), v(0, -1, 0))),
    faceRow("half", storedFace(front(0, 1.8, 5.8), v(0, -1, 0))), // ∩ 5.5 ≥ 0.5 × 10
    faceRow("third", storedFace(front(0, 3, 7), v(0, -1, 0))), // 2.5 < 5
    faceRow("small", storedFace(front(0, 1, 1.5), v(0, -1, 0))), // inside: 100 %
    faceRow(
      "tilted2deg",
      storedFace(
        [
          v(0, 0, 0),
          v(4, 0, 0),
          v(4, 2.5 * Math.tan((2 * Math.PI) / 180), 2.5),
          v(0, 2.5 * Math.tan((2 * Math.PI) / 180), 2.5),
        ],
        v(0, -1, 0)
      )
    ),
  ];
  assert.deepEqual(
    ids(findMeshPaintMatches({ candidate, rows, metrics: METRICS })).sort(),
    ["gap2mm", "half", "small"]
  );
});

test("FACE: filters (base map, part type, deleted, same id, metrics)", () => {
  const geometry = storedFace(front(), v(0, -1, 0));
  const candidate = faceRow("self", geometry);
  const rows = [
    faceRow("self", geometry),
    faceRow("otherMap", geometry, { baseMapId: "bm2" }),
    faceRow("deleted", geometry, { deletedAt: "2026-10-01T00:00:00.000Z" }),
    edgeRow("edge", storedEdge(v(0, 0, 0), v(4, 0, 0))),
    faceRow("ok", geometry),
  ];
  assert.deepEqual(
    ids(findMeshPaintMatches({ candidate, rows, metrics: METRICS })),
    ["ok"]
  );
  assert.deepEqual(
    findMeshPaintMatches({ candidate, rows, metrics: null }),
    []
  );
  // Degenerate candidate (zero area) never matches.
  const flat = faceRow(
    "flat",
    storedFace([v(0, 0, 0), v(1, 0, 0), v(2, 0, 0)], v(0, -1, 0))
  );
  assert.deepEqual(
    findMeshPaintMatches({ candidate: flat, rows, metrics: METRICS }),
    []
  );
});

test("EDGE: corner edge shared by two hosts, direction ignored", () => {
  const rows = [
    edgeRow("corner", storedEdge(v(4, 0, 0), v(4, 0, 2.5)), {
      hostAnnotationId: "wallA",
    }),
    edgeRow("parallel1cm", storedEdge(v(4, 0.01, 0), v(4, 0.01, 2.5))),
    edgeRow("collinearFar", storedEdge(v(4, 0, 3), v(4, 0, 5))),
    edgeRow("overlap60", storedEdge(v(4, 0, 1), v(4, 0, 4))), // 1.5 / min(2.5, 3)
    edgeRow("overlap40", storedEdge(v(4, 0, 1.5), v(4, 0, 4))), // 1.0 / 2.5
    edgeRow("crossing", storedEdge(v(3, 0, 1), v(5, 0, 1))),
  ];
  const candidate = edgeRow("cand", storedEdge(v(4, 0, 2.5), v(4, 0.002, 0)), {
    hostAnnotationId: "wallB",
  });
  assert.deepEqual(
    ids(findMeshPaintMatches({ candidate, rows, metrics: METRICS })).sort(),
    ["corner", "overlap60"]
  );
});

test("planPaintToggle: ADDED / REMOVED / REPLACED", () => {
  assert.deepEqual(planPaintToggle({ matches: [], templateId: "t1" }), {
    action: "ADDED",
    deleteIds: [],
    add: true,
  });
  const matches = [
    { id: "p1", annotationTemplateId: "t2" },
    { id: "p2", annotationTemplateId: "t1" },
  ];
  assert.deepEqual(planPaintToggle({ matches, templateId: "t1" }), {
    action: "REMOVED",
    deleteIds: ["p1", "p2"],
    add: false,
  });
  assert.deepEqual(planPaintToggle({ matches, templateId: "t3" }), {
    action: "REPLACED",
    deleteIds: ["p1", "p2"],
    add: true,
  });
});
