import test from "node:test";
import assert from "node:assert/strict";

import findOverlappingCuts from "./findOverlappingCuts.js";
import mergeCutRings from "./mergeCutRings.js";
import { cutToMultiPolygon } from "./cutRings.js";
import { multiPolygonArea } from "../../geometry/utils/polygonsIntersectionArea.js";

// run: node --test src/Features/duplicatesDetection/utils/findOverlappingCuts.test.mjs

let seq = 0;
const cut = (id, coords, types = {}) => ({
  id,
  points: coords.map(([x, y], i) => ({
    id: `p${(seq += 1)}`,
    x,
    y,
    type: types[i] ?? "square",
  })),
});
const polygon = (cuts, extra = {}) => ({
  id: "A",
  type: "POLYGON",
  annotationTemplateId: "T",
  points: [],
  cuts,
  ...extra,
});
const areaOf = (c) => multiPolygonArea(cutToMultiPolygon(c));

// Cuts of a real annotation (px): two squares, a pentagon, and an H-shaped
// opening stored four times (left leg, full H, right leg + bar, full H again
// with an unclosed contour).
const SQUARE_1 = cut("SQ1", [
  [1048.503, 836.784],
  [1093.822, 836.784],
  [1093.822, 882.694],
  [1048.503, 882.694],
  [1048.503, 836.784],
]);
const SQUARE_2 = cut("SQ2", [
  [1048.503, 888.014],
  [1093.822, 888.014],
  [1093.822, 933.726],
  [1048.503, 933.726],
  [1048.503, 888.014],
]);
const PENTAGON = cut("PENTA", [
  [1043.62, 1177.072],
  [1107.873, 1177.072],
  [1161.315, 1214.141],
  [1159.77, 1284.573],
  [1043.62, 1284.573],
  [1043.62, 1177.072],
]);
const LEFT_LEG = cut("LEFT", [
  [1348.059, 977.149],
  [1414.762, 1018.421],
  [1292.534, 1202.54],
  [1269.915, 1236.611],
  [1269.138, 1237.781],
  [1255.194, 1382.773],
  [1177.658, 1382.773],
  [1191.832, 1217.993],
  [1207.674, 1160.045],
  [1348.059, 977.149],
]);
const H_FULL = cut("H1", [
  [1348.059, 977.149],
  [1207.674, 1160.045],
  [1191.832, 1217.993],
  [1177.658, 1382.773],
  [1255.194, 1382.773],
  [1269.138, 1237.781],
  [1269.915, 1236.611],
  [1383.487, 1254.903],
  [1382.241, 1274.473],
  [1374.264, 1382.773],
  [1449.783, 1382.773],
  [1462.764, 1273.557],
  [1587.291, 1018.421],
  [1511.241, 981.3],
  [1393.845, 1224.998],
  [1292.534, 1202.54],
  [1414.762, 1018.421],
  [1348.059, 977.149],
]);
const RIGHT_LEG = cut("RIGHT", [
  [1292.534, 1202.54],
  [1393.845, 1224.998],
  [1511.241, 981.3],
  [1587.291, 1018.421],
  [1462.764, 1273.557],
  [1449.783, 1382.773],
  [1374.264, 1382.773],
  [1382.241, 1274.473],
  [1383.487, 1254.903],
  [1269.915, 1236.611],
  [1292.534, 1202.54],
]);
const H_UNCLOSED = cut("H2", [
  [1348.059, 977.149],
  [1414.762, 1018.421],
  [1290.663, 1205.069],
  [1393.845, 1224.998],
  [1511.241, 981.3],
  [1587.291, 1018.421],
  [1462.764, 1273.557],
  [1449.783, 1382.773],
  [1374.264, 1382.773],
  [1382.241, 1274.473],
  [1383.487, 1254.903],
  [1269.138, 1237.781],
  [1255.194, 1382.773],
  [1177.658, 1382.773],
  [1191.832, 1217.993],
  [1207.674, 1160.045],
]);
const H_CUTS = [LEFT_LEG, H_FULL, RIGHT_LEG, H_UNCLOSED];

test("real annotation: the H opening stored four times is one cluster", () => {
  const result = findOverlappingCuts(
    [polygon([SQUARE_1, SQUARE_2, PENTAGON, ...H_CUTS])],
    { minOverlapPx: 5 }
  );
  assert.equal(result.length, 1);
  const [overlap] = result;
  assert.equal(overlap.annotationId, "A");
  assert.equal(overlap.clusters.length, 1);
  assert.deepEqual([...overlap.clusters[0].cutIds].sort(), [
    "H1",
    "H2",
    "LEFT",
    "RIGHT",
  ]);
  assert.equal(overlap.cutsCount, 4);

  // the H is counted ~3 times: about twice its area comes off in excess
  const hArea = areaOf(H_FULL);
  const sum = H_CUTS.reduce((total, c) => total + areaOf(c), 0);
  assert.ok(overlap.overCountedPx > 1.9 * hArea);
  assert.ok(overlap.overCountedPx <= sum - hArea + 1e-6);
});

test("touching, disjoint or single cuts are not reported", () => {
  // SQUARE_1 / SQUARE_2 are 5 px apart, the pentagon is far away
  assert.deepEqual(
    findOverlappingCuts([polygon([SQUARE_1, SQUARE_2, PENTAGON])]),
    []
  );
  const left = cut("L", [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  const right = cut("R", [
    [10, 0],
    [20, 0],
    [20, 10],
    [10, 10],
  ]);
  assert.deepEqual(findOverlappingCuts([polygon([left, right])]), []);
  assert.deepEqual(findOverlappingCuts([polygon([left])]), []);
  assert.deepEqual(
    findOverlappingCuts([{ ...polygon([left, left]), type: "POLYLINE" }]),
    []
  );
});

test("a sliver overlap stays under the coverage threshold", () => {
  const a = cut("a", [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ]);
  const b = cut("b", [
    [99, 0],
    [199, 0],
    [199, 100],
    [99, 100],
  ]);
  assert.deepEqual(
    findOverlappingCuts([polygon([a, b])], { minOverlapPx: 2 }),
    []
  );
});

test("partial overlap: the over-counted area is the intersection", () => {
  const a = cut("a", [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ]);
  const b = cut("b", [
    [50, 0],
    [150, 0],
    [150, 100],
    [50, 100],
  ]);
  const [overlap] = findOverlappingCuts([polygon([a, b])], {
    minOverlapPx: 2,
  });
  assert.ok(Math.abs(overlap.overCountedPx - 5000) < 1e-6);
  assert.deepEqual(overlap.clusters[0].cutIds, ["a", "b"]);
});

test("arcs are expanded: two identical discs overlap by a disc area", () => {
  // circle through (0,-50) (50,0) (0,50) (-50,0), stored as S-C-S-C
  const coords = [
    [0, -50],
    [50, 0],
    [0, 50],
    [-50, 0],
  ];
  const types = { 1: "circle", 3: "circle" };
  const [overlap] = findOverlappingCuts(
    [polygon([cut("d1", coords, types), cut("d2", coords, types)])],
    { minOverlapPx: 2 }
  );
  const discArea = Math.PI * 50 * 50;
  assert.ok(Math.abs(overlap.overCountedPx - discArea) / discArea < 0.02);
});

test("mergeCutRings: the four H cuts become one ring of the H area", () => {
  const merged = mergeCutRings(H_CUTS);
  assert.ok(merged);
  const mergedArea = areaOf({ points: merged.points });
  const hArea = areaOf(H_FULL);
  assert.ok(Math.abs(mergedArea - hArea) / hArea < 0.01);
  // every corner of the H is an existing point: ids are reused
  const reused = merged.points.filter((p) => p.id).length;
  assert.ok(reused >= 16);
  assert.ok(merged.points.every((p) => p.type === "square"));
});

test("mergeCutRings: a crossing vertex has no id, disjoint cuts are refused", () => {
  const a = cut("a", [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ]);
  const b = cut("b", [
    [50, 50],
    [150, 50],
    [150, 150],
    [50, 150],
  ]);
  const merged = mergeCutRings([a, b]);
  assert.equal(merged.points.length, 8);
  assert.equal(merged.points.filter((p) => !p.id).length, 2);

  const far = cut("far", [
    [500, 500],
    [600, 500],
    [600, 600],
    [500, 600],
  ]);
  assert.equal(mergeCutRings([a, far]), null);
});

test("mergeCutRings: cuts enclosing an island are refused", () => {
  const ringCuts = [
    cut("top", [
      [0, 0],
      [100, 0],
      [100, 30],
      [0, 30],
    ]),
    cut("right", [
      [70, 0],
      [100, 0],
      [100, 100],
      [70, 100],
    ]),
    cut("bottom", [
      [0, 70],
      [100, 70],
      [100, 100],
      [0, 100],
    ]),
    cut("left", [
      [0, 0],
      [30, 0],
      [30, 100],
      [0, 100],
    ]),
  ];
  assert.equal(mergeCutRings(ringCuts), null);
});
