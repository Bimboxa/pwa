import assert from "node:assert/strict";
import { test } from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import {
  localGeometryToPaint,
  paintGeometryToLocal,
} from "./meshPaintFrame.js";
import { faceArea } from "./meshPaintGeometry.js";
import {
  METRICS,
  boxTriangles,
  near,
  nearV,
  quadTriangles,
  storedEdge,
  v,
} from "./meshPaintTestFixtures.mjs";
import planPaintResync, { matchPaintPartToIndex } from "./planPaintResync.js";

const X = v(1, 0, 0);
const Y = v(0, 1, 0);
const Z = v(0, 0, 1);
const neg = (n) => v(-n.x, -n.y, -n.z);

const faceRow = (id, contour, normal, extra = {}) => ({
  id,
  partType: "FACE",
  geometry: localGeometryToPaint(
    "FACE",
    { polygons: [{ contour, holes: [] }], normal },
    METRICS
  ),
  sync: { state: "OK", geomHash: "old", syncedAt: "2026-10-01T00:00:00.000Z" },
  ...extra,
});
const edgeRow = (id, a, b, extra = {}) => ({
  id,
  partType: "EDGE",
  geometry: storedEdge(a, b),
  sync: { state: "OK" },
  ...extra,
});

const resync = (rows, triangles, exactFaces) =>
  planPaintResync({
    rows,
    index: buildHostPartIndex({ triangles, exactFaces }),
    metrics: METRICS,
  });
const byId = (plan) =>
  Object.fromEntries(plan.map((entry) => [entry.id, entry]));
const local = (entry, partType = "FACE") =>
  paintGeometryToLocal(partType, entry.geometry, METRICS);
const planeOffset = (face) => {
  const p = face.polygons[0].contour[0];
  return p.x * face.normal.x + p.y * face.normal.y + p.z * face.normal.z;
};

// Thick wall 4 × 0.2 × 2.5 and its painted parements / top.
const WALL = boxTriangles(v(0, 0, 0), v(4, 0.2, 2.5), { flip: ["back"] });
const front = (y = 0, x0 = 0, x1 = 4, z1 = 2.5) => [
  v(x0, y, 0),
  v(x1, y, 0),
  v(x1, y, z1),
  v(x0, y, z1),
];
const wallRows = () => [
  faceRow("front", front(), neg(Y)),
  faceRow("back", front(0.2), Y),
  faceRow(
    "top",
    [v(0, 0, 2.5), v(4, 0, 2.5), v(4, 0.2, 2.5), v(0, 0.2, 2.5)],
    Z
  ),
];

test("unchanged host: every row OK, nothing to write", () => {
  const rows = wallRows();
  const plan = resync(rows, WALL);
  assert.equal(plan.length, 3);
  plan.forEach((entry, i) => {
    assert.equal(entry.state, "OK");
    assert.equal(entry.changed, false);
    assert.equal(entry.geometry, rows[i].geometry);
    assert.equal(entry.clearProvisional, false);
    assert.equal(entry.deleteProvisional, false);
  });
  // An orphan re-attaches: state change only, same geometry.
  const [orphan] = resync(
    [faceRow("o", front(), neg(Y), { sync: { state: "ORPHAN" } })],
    WALL
  );
  assert.equal(orphan.state, "OK");
  assert.equal(orphan.changed, true);
});

test("no write under 2 mm (z-fight lift), Stage 1 absorbs the 10 mm shrink", () => {
  const rows = wallRows();
  const lifted = boxTriangles(v(0, 0.0015, 0.001), v(4, 0.2, 2.501));
  for (const entry of resync(rows, lifted)) {
    assert.equal(entry.state, "OK");
    assert.equal(entry.changed, false, entry.id);
  }
  // Anti-aliasing shrink: parements 10 mm inward, top 5 mm lower.
  const shrunk = boxTriangles(v(0, 0.01, 0), v(4, 0.19, 2.495));
  const plan = byId(resync(rows, shrunk));
  for (const id of ["front", "back", "top"]) {
    assert.equal(plan[id].state, "OK");
    assert.equal(plan[id].changed, true, id);
  }
  const newFront = local(plan.front);
  nearV(newFront.normal, neg(Y), 1e-9);
  near(planeOffset(newFront), -0.01, 1e-9); // -y · (y = 0.01)
  const newBack = local(plan.back);
  nearV(newBack.normal, Y, 1e-9);
  near(planeOffset(newBack), 0.19, 1e-9);
  near(planeOffset(local(plan.top)), 2.495, 1e-9);
});

test("cut face stays ONE multi-polygon row, undo re-grows it, provisional copies", () => {
  const cut = [
    ...boxTriangles(v(0, 0, 0), v(2, 0.2, 2.5)),
    ...boxTriangles(v(2.01, 0, 0), v(4, 0.2, 2.5)),
  ];
  const [split] = resync([faceRow("front", front(), neg(Y))], cut);
  assert.equal(split.state, "OK");
  assert.equal(split.changed, true);
  const pieces = local(split);
  assert.equal(pieces.polygons.length, 2);
  near(faceArea(pieces), 2.5 * 3.99, 1e-9);

  // Undo of the cut: the two-polygon row grows back to the whole face.
  const [regrown] = resync(
    [{ ...faceRow("front", front(), neg(Y)), geometry: split.geometry }],
    WALL
  );
  assert.equal(regrown.changed, true);
  assert.equal(local(regrown).polygons.length, 1);
  near(faceArea(local(regrown)), 10, 1e-9);

  // Provisional copy on the new piece (2D split): trimmed, then confirmed.
  const piece = boxTriangles(v(2.01, 0, 0), v(4, 0.2, 2.5));
  const provisional = {
    sync: { state: "OK", provisional: true, geomHash: null },
  };
  const [copy] = resync([faceRow("copy", front(), neg(Y), provisional)], piece);
  assert.equal(copy.state, "OK");
  assert.equal(copy.clearProvisional, true);
  near(faceArea(local(copy)), 2.5 * 1.99, 1e-9);
  // A copied end-cap paint has nothing left on the piece: it is deleted,
  // never moved onto the new cut face (Stage 2 is off for copies).
  const cap = [v(0, 0.2, 0), v(0, 0, 0), v(0, 0, 2.5), v(0, 0.2, 2.5)];
  const [lostCopy] = resync([faceRow("cap", cap, neg(X), provisional)], piece);
  assert.equal(lostCopy.state, "ORPHAN");
  assert.equal(lostCopy.deleteProvisional, true);
});

test("cut pieces stay one plane even when the paint is 0.5° off", () => {
  const t = Math.tan((0.5 * Math.PI) / 180);
  const row = faceRow(
    "f",
    [v(-4, -4 * t, 0), v(4, 4 * t, 0), v(4, 4 * t, 2.5), v(-4, -4 * t, 2.5)],
    neg(Y)
  );
  const pieces = [
    ...boxTriangles(v(-4, 0, 0), v(-0.01, 0.2, 2.5)),
    ...boxTriangles(v(0.01, 0, 0), v(4, 0.2, 2.5)),
  ];
  const [entry] = resync([row], pieces);
  assert.equal(entry.state, "OK");
  assert.equal(local(entry).polygons.length, 2);
  near(faceArea(local(entry)), 2 * 3.99 * 2.5, 1e-9);
});

test("Stage 2: pushed face, slab top vs bottom", () => {
  // Front of a block pushed 0.5 m outward.
  const block = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  const pushed = boxTriangles(v(0, -0.5, 0), v(4, 2, 3));
  const blockFront = [v(0, 0, 0), v(4, 0, 0), v(4, 0, 3), v(0, 0, 3)];
  const [moved] = resync([faceRow("f", blockFront, neg(Y))], pushed);
  assert.equal(moved.state, "OK");
  near(planeOffset(local(moved)), 0.5, 1e-9); // y = -0.5
  // Unchanged block: not moved.
  assert.equal(
    resync([faceRow("f", blockFront, neg(Y))], block)[0].changed,
    false
  );

  // Slab 0.2 thick, top (+z) and bottom (-z) painted.
  const slabTop = [v(0, 0, 0.2), v(4, 0, 0.2), v(4, 3, 0.2), v(0, 3, 0.2)];
  const slabBottom = [v(0, 0, 0), v(0, 3, 0), v(4, 3, 0), v(4, 0, 0)];
  const rows = [
    faceRow("top", slabTop, Z),
    faceRow("bottom", slabBottom, neg(Z)),
  ];
  // Thicker (top raised to 0.5): the top follows, the bottom stays.
  const thick = byId(resync(rows, boxTriangles(v(0, 0, 0), v(4, 3, 0.5))));
  near(planeOffset(local(thick.top)), 0.5, 1e-9);
  assert.equal(thick.bottom.changed, false);
  // Raised (offset 0.3): each side follows its own face.
  const raised = byId(resync(rows, boxTriangles(v(0, 0, 0.3), v(4, 3, 0.5))));
  near(planeOffset(local(raised.top)), 0.5, 1e-9);
  near(planeOffset(local(raised.bottom)), -0.3, 1e-9);
  nearV(local(raised.bottom).normal, neg(Z), 1e-9);
});

test("thin wall (open host): both sides on one island; single-candidate Stage 2", () => {
  const sheet = (y) =>
    quadTriangles(v(0, y, 0), v(4, y, 0), v(4, y, 2.5), v(0, y, 2.5));
  const rows = [faceRow("minus", front(), neg(Y)), faceRow("plus", front(), Y)];
  const same = byId(resync(rows, sheet(0)));
  assert.equal(same.minus.changed, false);
  assert.equal(same.plus.changed, false);
  // Sheet moved 10 cm: one parallel candidate, each row keeps its side.
  const moved = byId(resync(rows, sheet(0.1)));
  nearV(local(moved.minus).normal, neg(Y), 1e-9);
  nearV(local(moved.plus).normal, Y, 1e-9);
  near(planeOffset(local(moved.plus)), 0.1, 1e-9);
  // Two parallel sheets and no side to trust: no guess.
  const two = resync(rows, [...sheet(0.3), ...sheet(-0.3)]);
  assert.ok(two.every((entry) => entry.state === "ORPHAN"));
});

test("Stage 2 on a closed host: nearest plane, ambiguity → ORPHAN", () => {
  const paint = faceRow(
    "f",
    [v(0, 0, 0), v(4, 0, 0), v(4, 0, 2), v(0, 0, 2)],
    neg(Y)
  );
  // Two steps pushed out by 0.5 and 0.52: within 10 % → ambiguous.
  const ambiguous = [
    ...boxTriangles(v(0, -0.5, 0), v(4, 0.2, 1)),
    ...boxTriangles(v(0, -0.52, 1), v(4, 0.2, 2)),
  ];
  const [a] = resync([paint], ambiguous);
  assert.equal(a.state, "ORPHAN");
  assert.equal(a.geometry, paint.geometry);
  // 0.5 and 0.7: the nearest wins (its island only).
  const distinct = [
    ...boxTriangles(v(0, -0.5, 0), v(4, 0.2, 1)),
    ...boxTriangles(v(0, -0.7, 1), v(4, 0.2, 2)),
  ];
  const [b] = resync([paint], distinct);
  assert.equal(b.state, "OK");
  near(planeOffset(local(b)), 0.5, 1e-9);
  near(faceArea(local(b)), 4, 1e-9);
});

test("lost face → ORPHAN, geometry kept; provisional → deleted", () => {
  // Painted jamb, the host now holds no +x face overlapping its projection
  // (Stage 2 would otherwise take a parallel same-side face, e.g. the end
  // cap of a wall whose door was filled in).
  const jamb = [v(2, 0, 0), v(2, 0.2, 0), v(2, 0.2, 2.1), v(2, 0, 2.1)];
  const row = faceRow("jamb", jamb, X);
  const elsewhere = boxTriangles(v(3, 0, 3), v(4, 0.2, 4));
  const [lost] = resync([row], elsewhere);
  assert.equal(lost.state, "ORPHAN");
  assert.equal(lost.changed, true);
  assert.equal(lost.geometry, row.geometry);
  assert.equal(lost.deleteProvisional, false);
  const [again] = resync([{ ...row, sync: { state: "ORPHAN" } }], elsewhere);
  assert.equal(again.changed, false);
  // Deleted rows are skipped, missing inputs plan nothing.
  assert.deepEqual(resync([{ ...row, deletedAt: "x" }], WALL), []);
  assert.deepEqual(
    planPaintResync({ rows: [row], index: null, metrics: METRICS }),
    []
  );
  assert.deepEqual(
    planPaintResync({
      rows: [row],
      index: buildHostPartIndex({ triangles: WALL }),
      metrics: null,
    }),
    []
  );
});

test("EDGE: shrink (Stage 1), wall height (shared plane), split edge, orphan", () => {
  const topFront = edgeRow("e", v(0, 0, 2.5), v(4, 0, 2.5));
  const [same] = resync([topFront], WALL);
  assert.equal(same.state, "OK");
  // First pass learns the sides of the edge: a write, points untouched.
  assert.equal(same.changed, true);
  assert.deepEqual(same.geometry.points, topFront.geometry.points);
  assert.equal(same.geometry.sides.length, 2);
  const learned = { ...topFront, geometry: same.geometry };
  const [stable] = resync([learned], WALL);
  assert.equal(stable.changed, false);
  assert.equal(stable.geometry, learned.geometry);

  const [shrunk] = resync(
    [topFront],
    boxTriangles(v(0, 0.01, 0), v(4, 0.19, 2.495))
  );
  assert.equal(shrunk.changed, true);
  nearV(local(shrunk, "EDGE").points[0], v(0, 0.01, 2.495), 1e-9);

  // Wall 0.5 m higher: top-back is 0.54 m away, top-front 0.5 m — the
  // shared front plane picks the top-front edge (with or without sides).
  for (const row of [topFront, learned]) {
    const [higher] = resync([row], boxTriangles(v(0, 0, 0), v(4, 0.2, 3)));
    assert.equal(higher.state, "OK");
    const pts = local(higher, "EDGE").points;
    nearV(pts[0], v(0, 0, 3), 1e-9);
    nearV(pts[1], v(4, 0, 3), 1e-9);
  }

  // Edge cut in two (2D split with a gap): best overlap wins.
  const cut = [
    ...boxTriangles(v(0, 0, 0), v(2.5, 0.2, 2.5)),
    ...boxTriangles(v(2.51, 0, 0), v(4, 0.2, 2.5)),
  ];
  const [split] = resync([topFront], cut);
  const splitPts = local(split, "EDGE").points;
  nearV(splitPts[0], v(0, 0, 2.5), 1e-9);
  nearV(splitPts[1], v(2.5, 0, 2.5), 1e-9);

  // Gone (host moved beyond its own diagonal): orphan.
  const [gone] = resync([topFront], boxTriangles(v(0, 8, 0), v(4, 8.2, 1)));
  assert.equal(gone.state, "ORPHAN");
});

test("EDGE: sides tell the top edge of a slab from its bottom edge", () => {
  const slabEdge = edgeRow("s", v(0, 0, 0.2), v(4, 0, 0.2));
  // Learn the sides on the slab as painted (0.2 thick).
  const [learn] = resync([slabEdge], boxTriangles(v(0, 0, 0), v(4, 3, 0.2)));
  const sides = local(learn, "EDGE").sides;
  assert.equal(sides.length, 2);
  assert.ok(sides.some((n) => n.z > 0.999) && sides.some((n) => n.y < -0.999));
  // Thicker slab: the bottom-front edge (0.2 away) is nearer than the new
  // top-front edge (0.3 away) but borders the bottom face.
  const [thick] = resync(
    [{ ...slabEdge, geometry: learn.geometry }],
    boxTriangles(v(0, 0, 0), v(4, 3, 0.5))
  );
  assert.equal(thick.state, "OK");
  nearV(local(thick, "EDGE").points[0], v(0, 0, 0.5), 1e-9);
});

test("matchPaintPartToIndex: Stage-1-only re-detection on an un-shrunk host", () => {
  const index = buildHostPartIndex({ triangles: WALL });
  // Picked on the shrunk display (10 mm in, 5 mm lower).
  const picked = {
    polygons: [{ contour: front(0.01, 0, 4, 2.495), holes: [] }],
    normal: neg(Y),
  };
  const match = matchPaintPartToIndex("FACE", picked, index, {
    allowFar: false,
  });
  assert.equal(match.stage, 1);
  near(faceArea(match.geometry), 10, 1e-9);
  near(planeOffset(match.geometry), 0, 1e-9);
  const edge = matchPaintPartToIndex(
    "EDGE",
    { points: [v(0, 0.01, 2.495), v(4, 0.01, 2.495)] },
    index,
    { allowFar: false }
  );
  nearV(edge.geometry.points[1], v(4, 0, 2.5), 1e-9);
  assert.equal(edge.geometry.sides.length, 2);
  // Too far for Stage 1.
  const far = {
    polygons: [{ contour: front(-0.3), holes: [] }],
    normal: neg(Y),
  };
  assert.equal(
    matchPaintPartToIndex("FACE", far, index, { allowFar: false }),
    null
  );
});

test("split source (nearOnly): never jumps to the new cut face, flag cleared", () => {
  // +x end cap painted at x = 4, the source host re-cut to [0, 2].
  const cap = [v(4, 0, 0), v(4, 0.2, 0), v(4, 0.2, 2.5), v(4, 0, 2.5)];
  const source = boxTriangles(v(0, 0, 0), v(2, 0.2, 2.5));
  const flagged = faceRow("cap", cap, X, {
    sync: { state: "OK", geomHash: null, nearOnly: true },
  });
  const [kept] = resync([flagged], source);
  assert.equal(kept.state, "ORPHAN");
  assert.equal(kept.geometry, flagged.geometry);
  assert.equal(kept.deleteProvisional, false);
  assert.equal(kept.clearNearOnly, true);

  // The source's front face (spanning the cut) is trimmed at Stage 1.
  const [front0] = resync(
    [faceRow("front", front(), neg(Y), { sync: { nearOnly: true } })],
    source
  );
  assert.equal(front0.state, "OK");
  assert.equal(front0.clearNearOnly, true);
  near(faceArea(local(front0)), 5, 1e-9);
});

test("Stage 2 needs half of the PAINT: a far end cap never takes a parement", () => {
  // Outer face (normal -y) of a wall 5.1 m long; the host now only holds a
  // 0.2 × 2.5 m end cap facing -y, 0.1 m away.
  const outer = faceRow(
    "outer",
    [v(0, -0.1, 0), v(5.1, -0.1, 0), v(5.1, -0.1, 2.5), v(0, -0.1, 2.5)],
    neg(Y)
  );
  const leg = boxTriangles(v(4.9, 0, 0), v(5.1, 5, 2.5));
  const [entry] = resync([outer], leg);
  assert.equal(entry.state, "ORPHAN");
});

test("Stage 3: a face slid within its own plane (offsetZ edit) follows", () => {
  const paint = faceRow("front", front(), neg(Y));
  // Wall raised by 2 m: the front face overlaps the paint on 0.5 m only.
  const [raised] = resync([paint], boxTriangles(v(0, 0, 2), v(4, 0.2, 4.5)));
  assert.equal(raised.state, "OK");
  const face = local(raised);
  near(Math.min(...face.polygons[0].contour.map((p) => p.z)), 2, 1e-9);
  nearV(face.normal, neg(Y), 1e-9);
  // Two candidate islands on the plane for a one-polygon paint: no guess.
  const [two] = resync(
    [paint],
    [
      ...boxTriangles(v(0, 0, 3), v(1.5, 0.2, 5)),
      ...boxTriangles(v(2.5, 0, 3), v(4, 0.2, 5)),
    ]
  );
  assert.equal(two.state, "ORPHAN");
});

test("EDGE Stage 1: the paint's sides pick between two near edges", () => {
  // 13 mm band: the top edges at y = 0 and y = 0.013 are both within 2 cm.
  const band = boxTriangles(v(0, 0, 0), v(4, 0.013, 0.1));
  const index = buildHostPartIndex({ triangles: band });
  const pick = (y, sides) =>
    matchPaintPartToIndex(
      "EDGE",
      { points: [v(0, y, 0.1), v(4, y, 0.1)], sides },
      index,
      { allowFar: false }
    );
  // Picked half-way, sides of the back edge (+y, +z): the back edge wins.
  const back = pick(0.0065, [Y, Z]);
  near(back.geometry.points[0].y, 0.013, 1e-9);
  const frontEdge = pick(0.0065, [neg(Y), Z]);
  near(frontEdge.geometry.points[0].y, 0, 1e-9);
});
