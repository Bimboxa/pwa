import assert from "node:assert/strict";
import { test } from "node:test";

import classifyMeshPaintsForSplit, {
  SPLIT_CLASS,
} from "./classifyMeshPaintsForSplit.js";
import { localGeometryToPaint } from "./meshPaintFrame.js";
import { METRICS, v } from "./meshPaintTestFixtures.mjs";

const face = (id, contour, normal) => ({
  id,
  partType: "FACE",
  geometry: localGeometryToPaint(
    "FACE",
    { polygons: [{ contour, holes: [] }], normal },
    METRICS
  ),
});
const edge = (id, a, b) => ({
  id,
  partType: "EDGE",
  geometry: localGeometryToPaint("EDGE", { points: [a, b] }, METRICS),
});

const byId = (result) => Object.fromEntries(result.map((r) => [r.id, r]));

// Wall [0, 4] along x, 0.2 thick (centred on y = 0), 2.5 high, cut at x = 2:
// the source keeps [0, 2], piece "B" gets [2, 4].
test("straight wall cut: far cap re-hosted, side / top faces spread", () => {
  const rows = [
    face(
      "capFar",
      [v(4, -0.1, 0), v(4, 0.1, 0), v(4, 0.1, 2.5), v(4, -0.1, 2.5)],
      v(1, 0, 0)
    ),
    face(
      "capNear",
      [v(0, 0.1, 0), v(0, -0.1, 0), v(0, -0.1, 2.5), v(0, 0.1, 2.5)],
      v(-1, 0, 0)
    ),
    face(
      "front",
      [v(0, -0.1, 0), v(4, -0.1, 0), v(4, -0.1, 2.5), v(0, -0.1, 2.5)],
      v(0, -1, 0)
    ),
    face(
      "top",
      [v(0, -0.1, 2.5), v(4, -0.1, 2.5), v(4, 0.1, 2.5), v(0, 0.1, 2.5)],
      v(0, 0, 1)
    ),
    edge("topFront", v(0, -0.1, 2.5), v(4, -0.1, 2.5)),
    edge("cornerFar", v(4, -0.1, 0), v(4, -0.1, 2.5)),
    edge("topNearHalf", v(0.2, 0.1, 2.5), v(1.9, 0.1, 2.5)),
  ];
  const result = byId(
    classifyMeshPaintsForSplit({
      rows,
      metrics: METRICS,
      sourceHostId: "S",
      pieces: [
        {
          hostId: "S",
          kind: "WALL",
          line: [v(0, 0), v(2, 0)],
          halfWidthM: 0.1,
        },
        {
          hostId: "B",
          kind: "WALL",
          line: [v(2, 0), v(4, 0)],
          halfWidthM: 0.1,
        },
      ],
    })
  );
  assert.equal(result.capFar.kind, SPLIT_CLASS.REHOST);
  assert.equal(result.capFar.rehostTo, "B");
  assert.equal(result.capNear.kind, SPLIT_CLASS.KEEP);
  assert.equal(result.front.kind, SPLIT_CLASS.SPAN);
  assert.deepEqual(result.front.copyTo, ["B"]);
  assert.equal(result.top.kind, SPLIT_CLASS.SPAN);
  assert.equal(result.topFront.kind, SPLIT_CLASS.SPAN);
  assert.equal(result.cornerFar.kind, SPLIT_CLASS.REHOST);
  assert.equal(result.topNearHalf.kind, SPLIT_CLASS.KEEP);
});

// L wall A(0,0) → B(5,0) → C(5,5), 0.2 thick, split at the corner B: the
// mitered outer corner (5.1, -0.1) belongs to neither piece.
test("L wall split at its corner: each outer face stays with its leg", () => {
  const rows = [
    face(
      "outerBC",
      [v(5.1, -0.1, 0), v(5.1, 5, 0), v(5.1, 5, 2.5), v(5.1, -0.1, 2.5)],
      v(1, 0, 0)
    ),
    face(
      "outerAB",
      [v(0, -0.1, 0), v(5.1, -0.1, 0), v(5.1, -0.1, 2.5), v(0, -0.1, 2.5)],
      v(0, -1, 0)
    ),
    face(
      "innerAB",
      [v(4.9, 0.1, 0), v(0, 0.1, 0), v(0, 0.1, 2.5), v(4.9, 0.1, 2.5)],
      v(0, 1, 0)
    ),
  ];
  const result = byId(
    classifyMeshPaintsForSplit({
      rows,
      metrics: METRICS,
      sourceHostId: "AB",
      pieces: [
        {
          hostId: "AB",
          kind: "WALL",
          line: [v(0, 0), v(5, 0)],
          halfWidthM: 0.1,
        },
        {
          hostId: "BC",
          kind: "WALL",
          line: [v(5, 0), v(5, 5)],
          halfWidthM: 0.1,
        },
      ],
    })
  );
  assert.equal(result.outerBC.kind, SPLIT_CLASS.REHOST);
  assert.equal(result.outerBC.rehostTo, "BC");
  assert.equal(result.outerAB.kind, SPLIT_CLASS.KEEP);
  assert.equal(result.innerAB.kind, SPLIT_CLASS.KEEP);
});

// Slab x ∈ [0, 6], y ∈ [-4, 4], 0.2 thick, cut along y = -3: the bigger
// back piece keeps the id ("S"), the front strip is "F".
test("slab cut parallel to its front face: the front face is re-hosted", () => {
  const rows = [
    face(
      "front",
      [v(0, -4, 0), v(6, -4, 0), v(6, -4, 0.2), v(0, -4, 0.2)],
      v(0, -1, 0)
    ),
    face(
      "left",
      [v(0, 4, 0), v(0, -4, 0), v(0, -4, 0.2), v(0, 4, 0.2)],
      v(-1, 0, 0)
    ),
    face(
      "top",
      [v(0, -4, 0.2), v(6, -4, 0.2), v(6, 4, 0.2), v(0, 4, 0.2)],
      v(0, 0, 1)
    ),
    face(
      "back",
      [v(6, 4, 0), v(0, 4, 0), v(0, 4, 0.2), v(6, 4, 0.2)],
      v(0, 1, 0)
    ),
  ];
  const result = byId(
    classifyMeshPaintsForSplit({
      rows,
      metrics: METRICS,
      sourceHostId: "S",
      pieces: [
        {
          hostId: "S",
          kind: "POLYGON",
          outline: [v(0, -3), v(6, -3), v(6, 4), v(0, 4)],
        },
        {
          hostId: "F",
          kind: "POLYGON",
          outline: [v(0, -4), v(6, -4), v(6, -3), v(0, -3)],
        },
      ],
    })
  );
  assert.equal(result.front.kind, SPLIT_CLASS.REHOST);
  assert.equal(result.front.rehostTo, "F");
  assert.equal(result.left.kind, SPLIT_CLASS.SPAN);
  assert.deepEqual(result.left.copyTo, ["F"]);
  assert.equal(result.top.kind, SPLIT_CLASS.SPAN);
  assert.equal(result.back.kind, SPLIT_CLASS.KEEP);
});

test("without metrics or pieces: unknown, copied everywhere", () => {
  const rows = [edge("e", v(0, 0, 0), v(1, 0, 0))];
  const [noMetrics] = classifyMeshPaintsForSplit({
    rows,
    metrics: null,
    sourceHostId: "S",
    pieces: [{ hostId: "B", kind: "WALL", line: [v(0, 0), v(1, 0)] }],
  });
  assert.equal(noMetrics.kind, SPLIT_CLASS.UNKNOWN);
  assert.deepEqual(noMetrics.copyTo, ["B"]);

  // A part on no piece (removed middle section).
  const [nowhere] = classifyMeshPaintsForSplit({
    rows: [edge("far", v(8, 3, 0), v(9, 3, 0))],
    metrics: METRICS,
    sourceHostId: "S",
    pieces: [
      { hostId: "S", kind: "WALL", line: [v(0, 0), v(1, 0)], halfWidthM: 0.1 },
      { hostId: "B", kind: "WALL", line: [v(2, 0), v(3, 0)], halfWidthM: 0.1 },
    ],
  });
  assert.equal(nowhere.kind, SPLIT_CLASS.UNKNOWN);
});
