import assert from "node:assert/strict";
import { test } from "node:test";

import matchWallFaceToGroundPolygons, {
  makeRingsContains,
  pointInRing,
} from "./matchWallFaceToGroundPolygons.js";

// 1 cm per px. Wall face along y = 100 (px), from x = 0 to x = 400, painted
// side toward +y (nx, ny = 0, 1), top at 2.5 m.
const TOL_PX = 5;
const face = (over = {}) => ({
  ax: 0,
  ay: 100,
  bx: 400,
  by: 100,
  nx: 0,
  ny: 1,
  topZ: 2.5,
  ...over,
});
const pt = (x, y) => ({ x, y });

function polygon({
  id = "sol",
  main,
  cuts = [],
  baseZ = 0,
  bottomAt = null,
  sloped = false,
}) {
  const rings = [
    { kind: "MAIN", closed: true, points: main },
    ...cuts.map((cut) => ({ kind: "CUT", closed: true, points: cut })),
  ];
  return {
    id,
    baseZ,
    sloped,
    rings,
    contains: makeRingsContains(rings),
    bottomAt: bottomAt ?? (() => baseZ),
  };
}
const match = (polygons, guideEdges = [face()]) =>
  matchWallFaceToGroundPolygons({ guideEdges, polygons, tolPx: TOL_PX });
const xs = (run) => run.points.map((p) => p.x);

test("pointInRing / makeRingsContains", () => {
  const square = [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)];
  assert.ok(pointInRing(pt(5, 5), square));
  assert.ok(!pointInRing(pt(15, 5), square));
  const contains = makeRingsContains([
    { kind: "MAIN", points: square },
    { kind: "CUT", points: [pt(4, 4), pt(6, 4), pt(6, 6), pt(4, 6)] },
  ]);
  assert.ok(contains(pt(1, 1)));
  assert.ok(!contains(pt(5, 5)));
});

test("a room glued to the painted side → one run along the whole facet", () => {
  const room = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 0.1,
  });
  const runs = match([room]);
  assert.equal(runs.length, 1);
  const [run] = runs;
  assert.equal(run.polygonId, "sol");
  assert.equal(run.closeLine, false);
  assert.equal(run.topZ, 2.5);
  assert.deepEqual(
    run.points.map((p) => [p.x, p.y, p.bottomZ]),
    [
      [0, 100, 0.1],
      [400, 100, 0.1],
    ]
  );
});

test("a wall standing inside a slab (no contour along it) is on that slab", () => {
  const slab = polygon({
    main: [pt(-500, -500), pt(900, -500), pt(900, 900), pt(-500, 900)],
    baseZ: -0.2,
  });
  const [run] = match([slab]);
  assert.deepEqual(xs(run), [0, 400]);
  assert.equal(run.points[0].bottomZ, -0.2);
  // The other side of the same wall stands on it too.
  assert.equal(match([slab], [face({ ny: -1 })]).length, 1);
});

test("the room on the other side of the wall does not match", () => {
  const behind = polygon({
    main: [pt(0, -200), pt(400, -200), pt(400, 100), pt(0, 100)],
  });
  assert.deepEqual(match([behind]), []);
  assert.equal(match([behind], [face({ ny: -1 })]).length, 1);
});

test("a floor 6 cm away from the face does not match, 4 cm does", () => {
  const far = polygon({
    main: [pt(0, 106), pt(400, 106), pt(400, 400), pt(0, 400)],
  });
  const near = polygon({
    main: [pt(0, 104), pt(400, 104), pt(400, 400), pt(0, 400)],
  });
  assert.equal(match([far]).length, 0);
  assert.equal(match([near]).length, 1);
});

test("a room narrower than the facet gives a run cut at its contour", () => {
  // Room from x = 100 to x = 300 under the facet (its side walls cross it).
  const room = polygon({
    main: [pt(100, 100), pt(300, 100), pt(300, 400), pt(100, 400)],
  });
  const runs = match([room]);
  assert.equal(runs.length, 1);
  assert.deepEqual(xs(runs[0]), [100, 300]);
});

test("two rooms side by side → two runs with their own floor, split at the partition", () => {
  const left = polygon({
    id: "left",
    main: [pt(-50, 50), pt(150, 50), pt(150, 400), pt(-50, 400)],
    baseZ: 0,
  });
  const right = polygon({
    id: "right",
    main: [pt(150, 50), pt(500, 50), pt(500, 400), pt(150, 400)],
    baseZ: 0.3,
  });
  const runs = match([left, right]);
  assert.deepEqual(
    runs.map((run) => [run.polygonId, xs(run), run.points[0].bottomZ]),
    [
      ["left", [0, 150], 0],
      ["right", [150, 400], 0.3],
    ]
  );
});

test("a cut (a column hole) breaks the run", () => {
  const room = polygon({
    main: [pt(-500, -500), pt(900, -500), pt(900, 900), pt(-500, 900)],
    cuts: [[pt(150, 90), pt(250, 90), pt(250, 200), pt(150, 200)]],
  });
  const runs = match([room]);
  assert.deepEqual(runs.map(xs), [
    [0, 150],
    [250, 400],
  ]);
});

test("overlapping floors: the highest one wins", () => {
  const low = polygon({
    id: "low",
    main: [pt(-50, 50), pt(500, 50), pt(500, 400), pt(-50, 400)],
    baseZ: -1,
  });
  const high = polygon({
    id: "high",
    main: [pt(-50, 50), pt(500, 50), pt(500, 400), pt(-50, 400)],
    baseZ: 0.5,
  });
  const runs = match([low, high]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].polygonId, "high");
});

test("no height above the floor → no run; sloped floor carries bottomZ per vertex", () => {
  const flat = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 2.5,
  });
  assert.equal(match([flat]).length, 0);
  const ramp = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 0,
    sloped: true,
    bottomAt: (p) => p.x / 400, // 0 → 1 m along the facet
  });
  const [run] = match([ramp]);
  assert.equal(run.sloped, true);
  assert.deepEqual(
    run.points.map((p) => p.bottomZ),
    [0, 1]
  );
});

test("two facets with different tops → two runs", () => {
  const room = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
  });
  const runs = match(
    [room],
    [face({ bx: 200, topZ: 2.5 }), face({ ax: 200, topZ: 3 })]
  );
  assert.deepEqual(
    runs.map((run) => [run.topZ, xs(run)]),
    [
      [2.5, [0, 200]],
      [3, [200, 400]],
    ]
  );
});
