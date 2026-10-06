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

test("a room glued to the painted side → one run along the shared edge", () => {
  // Room: 400 × 300 px, its top edge on the wall face.
  const room = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 0.1,
  });
  const runs = matchWallFaceToGroundPolygons({
    guideEdges: [face()],
    polygons: [room],
    tolPx: TOL_PX,
  });
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

test("the room on the other side of the wall does not match", () => {
  const behind = polygon({
    main: [pt(0, -200), pt(400, -200), pt(400, 100), pt(0, 100)],
  });
  assert.deepEqual(
    matchWallFaceToGroundPolygons({
      guideEdges: [face()],
      polygons: [behind],
      tolPx: TOL_PX,
    }),
    []
  );
  // Same room, painted side flipped toward -y: matches.
  const runs = matchWallFaceToGroundPolygons({
    guideEdges: [face({ ny: -1 })],
    polygons: [behind],
    tolPx: TOL_PX,
  });
  assert.equal(runs.length, 1);
});

test("a polygon 6 cm away from the face does not match, 4 cm does", () => {
  const far = polygon({
    main: [pt(0, 106), pt(400, 106), pt(400, 400), pt(0, 400)],
  });
  const near = polygon({
    main: [pt(0, 104), pt(400, 104), pt(400, 400), pt(0, 400)],
  });
  assert.equal(
    matchWallFaceToGroundPolygons({
      guideEdges: [face()],
      polygons: [far],
      tolPx: TOL_PX,
    }).length,
    0
  );
  assert.equal(
    matchWallFaceToGroundPolygons({
      guideEdges: [face()],
      polygons: [near],
      tolPx: TOL_PX,
    }).length,
    1
  );
});

test("a room edge longer than the facet is cut at the facet ends", () => {
  const room = polygon({
    main: [pt(-100, 100), pt(600, 100), pt(600, 400), pt(-100, 400)],
  });
  const [run] = matchWallFaceToGroundPolygons({
    guideEdges: [face()],
    polygons: [room],
    tolPx: TOL_PX,
  });
  assert.deepEqual(
    run.points.map((p) => [p.x, p.y]),
    [
      [0, 100],
      [400, 100],
    ]
  );
});

test("a cut hugging the facet (a column) gives a closed run", () => {
  // Column 100 × 100 px standing on the wall face, inside a big room.
  const column = [pt(100, 100), pt(200, 100), pt(200, 200), pt(100, 200)];
  const room = polygon({
    main: [pt(-500, -500), pt(900, -500), pt(900, 900), pt(-500, 900)],
    cuts: [column],
  });
  const edges = [
    { ax: 100, ay: 100, bx: 200, by: 100, nx: 0, ny: -1, topZ: 2.5 },
    { ax: 200, ay: 100, bx: 200, by: 200, nx: 1, ny: 0, topZ: 2.5 },
    { ax: 200, ay: 200, bx: 100, by: 200, nx: 0, ny: 1, topZ: 2.5 },
    { ax: 100, ay: 200, bx: 100, by: 100, nx: -1, ny: 0, topZ: 2.5 },
  ];
  const runs = matchWallFaceToGroundPolygons({
    guideEdges: edges,
    polygons: [room],
    tolPx: TOL_PX,
  });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].closeLine, true);
  assert.equal(runs[0].points.length, 4);
});

test("no height above the floor → no run; sloped floor carries bottomZ per vertex", () => {
  const flat = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 2.5,
  });
  assert.equal(
    matchWallFaceToGroundPolygons({
      guideEdges: [face()],
      polygons: [flat],
      tolPx: TOL_PX,
    }).length,
    0
  );
  const ramp = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
    baseZ: 0,
    sloped: true,
    bottomAt: (p) => p.x / 400, // 0 → 1 m along the edge
  });
  const [run] = matchWallFaceToGroundPolygons({
    guideEdges: [face()],
    polygons: [ramp],
    tolPx: TOL_PX,
  });
  assert.equal(run.sloped, true);
  assert.deepEqual(
    run.points.map((p) => p.bottomZ),
    [0, 1]
  );
});

test("two facets with different tops along one edge → two runs sharing a point", () => {
  const room = polygon({
    main: [pt(0, 100), pt(400, 100), pt(400, 400), pt(0, 400)],
  });
  const runs = matchWallFaceToGroundPolygons({
    guideEdges: [face({ bx: 200, topZ: 2.5 }), face({ ax: 200, topZ: 3 })],
    polygons: [room],
    tolPx: TOL_PX,
  });
  assert.equal(runs.length, 2);
  assert.deepEqual(
    runs.map((run) => [run.topZ, run.points.map((p) => p.x)]),
    [
      [2.5, [0, 200]],
      [3, [200, 400]],
    ]
  );
});
