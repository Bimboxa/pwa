import assert from "node:assert/strict";
import { test } from "node:test";

import computeJoinAnnotationEnds, {
  computeMergesForAnnotation,
} from "./computeJoinAnnotationEnds.js";

// meterByPx = 0.01 → 1 cm = 1 px, strokeWidth 40 cm = 40 px.
const MBP = 0.01;

const wall = (id, pts, extra = {}) => ({
  id,
  type: "POLYLINE",
  strokeWidth: 40,
  strokeWidthUnit: "CM",
  points: pts.map(([x, y], k) => ({ id: `${id}_${k}`, x, y })),
  ...extra,
});

const rectAround = (cx, cy, half = 30) => ({
  x: cx - half,
  y: cy - half,
  width: 2 * half,
  height: 2 * half,
});

const near = (p, x, y, tol = 1e-6) => {
  assert.ok(
    Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol,
    `expected (${x}, ${y}), got (${p.x}, ${p.y})`
  );
};

const byPoint = (moves) => Object.fromEntries(moves.map((m) => [m.pointId, m]));

test("user example: two 70 cm walls meeting at ~60°", () => {
  const meterByPx = 0.01716216216216216;
  const A = {
    id: "A",
    type: "POLYLINE",
    strokeWidth: 70,
    strokeWidthUnit: "CM",
    points: [
      { id: "a0", x: 2823.262, y: 3752.739 },
      { id: "a1", x: 751.143, y: 999.142 },
      { id: "a2", x: 751.143, y: 476.555 },
      { id: "a3", x: 4566.577, y: 476.555 },
    ],
  };
  const B = {
    id: "B",
    type: "POLYLINE",
    strokeWidth: 70,
    strokeWidthUnit: "CM",
    points: [
      { id: "b0", x: 5223.256, y: 1982.17 },
      { id: "b1", x: 4032.611, y: 3596.906 },
      { id: "b2", x: 2854.628, y: 3743.627 },
    ],
  };
  const { moves, reason } = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(2838, 3748, 60),
    meterByPx,
  });
  assert.equal(reason, undefined);
  assert.equal(moves.length, 2);
  const m = byPoint(moves);
  // A (closest to the intersection) penetrates B fully; B enters A by 1 cm
  // on its near edge AND stays 1 cm behind A's end cap (its outer corner
  // lands next to the outer corner of the junction — the user's expected
  // end for B was (2807.789, 3749.886), i.e. flush with A's cap).
  near(m.a0, 2826.78, 3757.41, 0.05);
  near(m.b2, 2807.96, 3749.44, 0.05);
  assert.ok(Math.hypot(m.b2.x - 2807.789, m.b2.y - 3749.886) < 0.6);

  // Both corners of B's end cap lie inside A's finite band: lateral offset
  // within ±w/2 and behind (or on) A's cap. The outer corner sits exactly on
  // the junction's outer corner: the 1 cm cap margin would push it out
  // through A's outer edge, so the far-edge clamp wins there.
  const w = 0.7 / meterByPx;
  const dA = (() => {
    const dx = m.a0.x - 751.143;
    const dy = m.a0.y - 999.142;
    const l = Math.hypot(dx, dy);
    return { x: dx / l, y: dy / l };
  })();
  const nA = { x: -dA.y, y: dA.x };
  const dB = (() => {
    const dx = m.b2.x - 4032.611;
    const dy = m.b2.y - 3596.906;
    const l = Math.hypot(dx, dy);
    return { x: dx / l, y: dy / l };
  })();
  const nB = { x: -dB.y, y: dB.x };
  for (const sgn of [-1, 1]) {
    const c = {
      x: m.b2.x + (sgn * w * nB.x) / 2,
      y: m.b2.y + (sgn * w * nB.y) / 2,
    };
    const rel = { x: c.x - m.a0.x, y: c.y - m.a0.y };
    const along = rel.x * dA.x + rel.y * dA.y;
    const off = rel.x * nA.x + rel.y * nA.y;
    assert.ok(along <= 1e-6, `corner ${sgn} pokes past A's cap: ${along}`);
    assert.ok(
      Math.abs(off) <= w / 2 + 1e-6,
      `corner ${sgn} outside A's band: ${off}`
    );
  }
  assert.equal(m.a0.annotationId, "A");
  assert.equal(m.b2.annotationId, "B");
});

test("right angle, equal widths: X reaches Y's far edge, Y enters X by 1 cm", () => {
  const A = wall("A", [
    [0, 100],
    [0, 0],
  ]);
  const B = wall("B", [
    [100, 0],
    [0, 0],
  ]);
  const { moves } = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  const m = byPoint(moves);
  near(m.A_1, 0, -20);
  near(m.B_1, 19, 0);
});

test("the thinner wall penetrates whatever the input order", () => {
  const thick = wall("T", [
    [0, 100],
    [0, 0],
  ]); // 40 px
  const thin = wall(
    "N",
    [
      [100, 0],
      [0, 0],
    ],
    { strokeWidth: 20 }
  ); // 20 px
  for (const annotations of [
    [thick, thin],
    [thin, thick],
  ]) {
    const { moves } = computeJoinAnnotationEnds({
      annotations,
      rect: rectAround(0, 0),
      meterByPx: MBP,
    });
    const m = byPoint(moves);
    // thin: end at I − 20·dN → x = -20 (flush with thick's far edge x = -20)
    near(m.N_1, -20, 0);
    // thick: enters thin's band ([-10, 10] in y) by 1 px → y = 9
    near(m.T_1, 0, 9);
  }
});

test("tie on widths: the end closest to the intersection penetrates", () => {
  const A = wall("A", [
    [0, 100],
    [0, -3],
  ]); // overshoots past I by 3
  const B = wall("B", [
    [100, 0],
    [10, 0],
  ]); // stops 10 before I
  const { moves } = computeJoinAnnotationEnds({
    annotations: [B, A],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  const m = byPoint(moves);
  near(m.A_1, 0, -20);
  near(m.B_1, 19, 0);
});

test("STRIP one-sided band (last-point end)", () => {
  const A = wall("A", [
    [0, 100],
    [0, 0],
  ]);
  // Path (100,0)→(0,0): left normal (0,-1) → band y ∈ [-40, 0].
  const S = wall(
    "S",
    [
      [100, 0],
      [0, 0],
    ],
    { type: "STRIP", stripOrientation: 1 }
  );
  const { moves } = computeJoinAnnotationEnds({
    annotations: [A, S],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  const m = byPoint(moves);
  near(m.A_1, 0, -40); // far edge of the strip band
  near(m.S_1, 19, 0);
});

test("STRIP one-sided band, mirrored for a first-point end", () => {
  const A = wall("A", [
    [0, 100],
    [0, 0],
  ]);
  // Path (0,0)→(100,0): left normal (0,1) → band y ∈ [0, 40]; the end is
  // the FIRST vertex, so the band is mirrored against the reversed direction.
  const S = wall(
    "S",
    [
      [0, 0],
      [100, 0],
    ],
    { type: "STRIP", stripOrientation: 1 }
  );
  const { moves } = computeJoinAnnotationEnds({
    annotations: [A, S],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  const m = byPoint(moves);
  // A arrives from y = 100: near edge y = 40, far edge y = 0.
  near(m.A_1, 0, 0);
  near(m.S_0, 19, 0);
});

test("near-parallel collinear ends bridge to the midpoint", () => {
  const A = wall("A", [
    [0, 100],
    [0, 10],
  ]);
  const B = wall("B", [
    [0, -100],
    [0, -10],
  ]);
  const { moves } = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  const m = byPoint(moves);
  near(m.A_1, 0, 0);
  near(m.B_1, 0, 0);
});

test("T junction: single end enters the crossing wall's band by 1 cm", () => {
  const A = wall("A", [
    [0, 100],
    [0, 10],
  ]);
  const H = wall("H", [
    [-100, 0],
    [100, 0],
  ]);
  const { moves, reason } = computeJoinAnnotationEnds({
    annotations: [A, H],
    rect: rectAround(0, 0, 20),
    meterByPx: MBP,
  });
  assert.equal(reason, undefined);
  assert.equal(moves.length, 1);
  near(moves[0], 0, 19);
  assert.equal(moves[0].pointId, "A_1");
});

test("three ends: closest pair joined as a corner, leftover T-joined", () => {
  const A = wall("A", [
    [0, 100],
    [0, 0],
  ]);
  const B = wall("B", [
    [100, 0],
    [0, 0],
  ]);
  const C = wall("C", [
    [-100, 0],
    [-10, 0],
  ]);
  const { moves } = computeJoinAnnotationEnds({
    annotations: [A, B, C],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.equal(moves.length, 3);
  const m = byPoint(moves);
  near(m.A_1, 0, -20);
  near(m.B_1, 19, 0);
  near(m.C_1, -19, 0); // enters A's band [-20, 20] from the left by 1 px
});

test("PX widths are skipped, no scale → NO_SCALE", () => {
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 0],
    ],
    { strokeWidthUnit: "PX" }
  );
  const B = wall("B", [
    [100, 0],
    [0, 0],
  ]);
  const r1 = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.deepEqual(r1.skipped, [{ annotationId: "A", reason: "PX_WIDTH" }]);
  // B alone has an end but nothing to join against (A is skipped).
  assert.equal(r1.moves.length, 0);
  assert.equal(r1.reason, "NO_TARGET");

  const r2 = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: 0,
  });
  assert.equal(r2.reason, "NO_SCALE");
  assert.equal(r2.moves.length, 0);
});

test("closed lines, openings, single points and ends outside the rect are ignored", () => {
  const closed = wall(
    "K",
    [
      [0, 100],
      [0, 0],
      [50, 50],
    ],
    { closeLine: true }
  );
  const opening = wall(
    "O",
    [
      [0, 100],
      [0, 0],
    ],
    { isOpening: true }
  );
  const single = wall("P", [[0, 0]]);
  const far = wall("F", [
    [500, 500],
    [400, 400],
  ]);
  const B = wall("B", [
    [100, 0],
    [0, 0],
  ]);
  const { moves, reason } = computeJoinAnnotationEnds({
    annotations: [closed, opening, single, far, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.equal(moves.length, 0);
  assert.equal(reason, "NO_TARGET");
  const empty = computeJoinAnnotationEnds({
    annotations: [far],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.equal(empty.reason, "NO_END");
});

test("input points are not mutated", () => {
  const A = wall("A", [
    [0, 100],
    [0, 0],
  ]);
  const B = wall("B", [
    [100, 0],
    [0, 0],
  ]);
  const snapshot = JSON.stringify([A, B]);
  computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.equal(JSON.stringify([A, B]), snapshot);
});

// ---------------------------------------------------------------------------
// mergeIfPossible ("Fusionner si possible")
// ---------------------------------------------------------------------------

const T = { annotationTemplateId: "tpl" };
const mergeOf = (annotations, rect, extra = {}) =>
  computeJoinAnnotationEnds({
    annotations,
    rect,
    meterByPx: MBP,
    mergeIfPossible: true,
    ...extra,
  });

test("merge: same template + width at a corner → one junction at the intersection", () => {
  // A ends (last) at (0, 10) going up; B ends (first) at (10, 0) going left.
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    T
  );
  const { moves, merges, reason } = mergeOf([A, B], rectAround(0, 0));
  assert.equal(reason, undefined);
  assert.equal(moves.length, 0);
  assert.equal(merges.length, 1);
  const m = merges[0];
  near(m.junction, 0, 0);
  // Tie on point count → e1 (A) survives; its end is the LAST vertex.
  assert.equal(m.keepId, "A");
  assert.equal(m.keepEndPointId, "A_1");
  assert.equal(m.dropId, "B");
  assert.equal(m.dropEndPointId, "B_0");
  assert.equal(m.attachAtStart, false);
  // B's end is its FIRST vertex and we append → no reversal.
  assert.equal(m.reverseDropped, false);
});

test("merge: chaining flags for the 4 FIRST/LAST combinations", () => {
  const cases = [
    // [A pts, B pts, attachAtStart, reverseDropped]
    [
      [
        [0, 100],
        [0, 10],
      ],
      [
        [10, 0],
        [100, 0],
      ],
      false,
      false,
    ],
    [
      [
        [0, 100],
        [0, 10],
      ],
      [
        [100, 0],
        [10, 0],
      ],
      false,
      true,
    ],
    [
      [
        [0, 10],
        [0, 100],
      ],
      [
        [10, 0],
        [100, 0],
      ],
      true,
      true,
    ],
    [
      [
        [0, 10],
        [0, 100],
      ],
      [
        [100, 0],
        [10, 0],
      ],
      true,
      false,
    ],
  ];
  for (const [aPts, bPts, attachAtStart, reverseDropped] of cases) {
    const { merges } = mergeOf(
      [wall("A", aPts, T), wall("B", bPts, T)],
      rectAround(0, 0)
    );
    assert.equal(merges.length, 1);
    assert.equal(merges[0].keepId, "A");
    assert.equal(merges[0].attachAtStart, attachAtStart);
    assert.equal(merges[0].reverseDropped, reverseDropped);
    near(merges[0].junction, 0, 0);
  }
});

test("merge: the wall with more points survives", () => {
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0],
      [100, 0],
      [100, 50],
    ],
    T
  );
  const { merges } = mergeOf([A, B], rectAround(0, 0));
  assert.equal(merges.length, 1);
  assert.equal(merges[0].keepId, "B");
  assert.equal(merges[0].dropId, "A");
  assert.equal(merges[0].attachAtStart, true);
  // A's end is its LAST vertex and we prepend → no reversal.
  assert.equal(merges[0].reverseDropped, false);
});

test("merge: different width or template → classic corner join", () => {
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    T
  );
  const B30 = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    { ...T, strokeWidth: 30 }
  );
  const r1 = mergeOf([A, B30], rectAround(0, 0));
  assert.equal(r1.merges.length, 0);
  assert.equal(r1.moves.length, 2);

  const B2 = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    { annotationTemplateId: "other" }
  );
  const r2 = mergeOf([A, B2], rectAround(0, 0));
  assert.equal(r2.merges.length, 0);
  assert.equal(r2.moves.length, 2);

  // No template on one side → no merge either.
  const B3 = wall("B", [
    [10, 0],
    [100, 0],
  ]);
  const r3 = mergeOf([A, B3], rectAround(0, 0));
  assert.equal(r3.merges.length, 0);
  assert.equal(r3.moves.length, 2);

  // Different types (POLYLINE vs STRIP) never merge.
  const S = wall(
    "S",
    [
      [10, 0],
      [100, 0],
    ],
    { ...T, type: "STRIP" }
  );
  const r4 = mergeOf([A, S], rectAround(0, 0));
  assert.equal(r4.merges.length, 0);
});

test("merge: mergeIfPossible=false keeps the classic behaviour", () => {
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    T
  );
  const off = computeJoinAnnotationEnds({
    annotations: [A, B],
    rect: rectAround(0, 0),
    meterByPx: MBP,
  });
  assert.equal(off.merges.length, 0);
  assert.equal(off.moves.length, 2);
});

test("merge: parallel collinear ends (≤ 1 cm) meet at their midpoint", () => {
  const A = wall(
    "A",
    [
      [-100, 0],
      [-10, 0],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0.5],
      [100, 0.5],
    ],
    T
  );
  const { merges, moves } = mergeOf([A, B], rectAround(0, 0));
  assert.equal(moves.length, 0);
  assert.equal(merges.length, 1);
  near(merges[0].junction, 0, 0, 1e-6);
});

test("merge: parallel ends offset by 5 cm → classic midpoint bridge", () => {
  const A = wall(
    "A",
    [
      [-100, 0],
      [-10, 0],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 5],
      [100, 5],
    ],
    T
  );
  const { merges, moves } = mergeOf([A, B], rectAround(0, 0));
  assert.equal(merges.length, 0);
  assert.equal(moves.length, 2);
  const m = byPoint(moves);
  near(m.A_1, 0, 0);
  near(m.B_0, 0, 5);
});

test("merge: parallel ends pointing the same way (overlap) do not merge", () => {
  // Both ends point to +x: A's last end and B's first end (B runs to -x).
  const A = wall(
    "A",
    [
      [-100, 0],
      [-10, 0],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0],
      [-100, 0],
    ],
    T
  );
  const { merges } = mergeOf([A, B], rectAround(0, 0));
  assert.equal(merges.length, 0);
});

test("merge: STRIP band side must match after chaining", () => {
  const S = { ...T, type: "STRIP" };
  // Appended without reversal: orientations must be equal.
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    { ...S, stripOrientation: 1 }
  );
  const Bsame = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    { ...S, stripOrientation: 1 }
  );
  const Bopp = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    { ...S, stripOrientation: -1 }
  );
  assert.equal(mergeOf([A, Bsame], rectAround(0, 0)).merges.length, 1);
  assert.equal(mergeOf([A, Bopp], rectAround(0, 0)).merges.length, 0);
  // Appended WITH reversal (B's end is its last vertex): the reversed path
  // flips the band side, so opposite orientations are the compatible ones.
  const Brev = wall(
    "B",
    [
      [100, 0],
      [10, 0],
    ],
    { ...S, stripOrientation: -1 }
  );
  const BrevSame = wall(
    "B",
    [
      [100, 0],
      [10, 0],
    ],
    { ...S, stripOrientation: 1 }
  );
  const r = mergeOf([A, Brev], rectAround(0, 0));
  assert.equal(r.merges.length, 1);
  assert.equal(r.merges[0].reverseDropped, true);
  assert.equal(mergeOf([A, BrevSame], rectAround(0, 0)).merges.length, 0);
});

test("merge: intersection behind the neighbour vertex → no merge", () => {
  // A's end segment is 10 px long (end at (0, 10) pointing up); B's line
  // crosses A's line at (0, 30), i.e. 20 px behind A's end — past A's
  // neighbour vertex. Only the two ends are inside the rectangle.
  const A = wall(
    "A",
    [
      [0, 20],
      [0, 10],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [20, -6],
      [10, 12],
    ],
    T
  );
  const { merges, moves } = mergeOf([A, B], {
    x: -5,
    y: 5,
    width: 20,
    height: 10,
  });
  assert.equal(merges.length, 0);
  assert.equal(moves.length, 2);
});

test("merge: both ends of the same wall never merge", () => {
  const A = wall(
    "A",
    [
      [10, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 10],
    ],
    T
  );
  const { merges, moves } = mergeOf([A], rectAround(0, 0));
  assert.equal(merges.length, 0);
  assert.equal(moves.length, 2);
});

test("merge: merged ends are consumed, leftover end T-joins the survivor", () => {
  const A = wall(
    "A",
    [
      [0, 100],
      [0, 10],
    ],
    T
  );
  const B = wall(
    "B",
    [
      [10, 0],
      [100, 0],
    ],
    T
  );
  // C ends near the junction too, but far enough to be the leftover.
  const C = wall(
    "C",
    [
      [40, -100],
      [40, -25],
    ],
    T
  );
  const { merges, moves } = mergeOf([A, B, C], {
    x: -30,
    y: -30,
    width: 80,
    height: 60,
  });
  assert.equal(merges.length, 1);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].annotationId, "C");
});

// computeMergesForAnnotation (« Segment similaire » + « Fusionner »)

const templated = (id, pts, extra = {}) =>
  wall(id, pts, { annotationTemplateId: "t1", ...extra });

test("new segment: a collinear wall of the same template absorbs it", () => {
  const created = templated("new", [
    [100, 100],
    [100, 300],
  ]);
  const [merge, ...rest] = computeMergesForAnnotation({
    annotation: created,
    annotations: [
      templated("old", [
        [100, 310],
        [100, 500],
      ]),
    ],
    meterByPx: MBP,
    reachPx: 74,
  });
  assert.equal(rest.length, 0);
  // The existing wall survives; the new segment is the absorbed one.
  assert.equal(merge.keepId, "old");
  assert.equal(merge.dropId, "new");
  assert.equal(merge.keepEndPointId, "old_0");
  assert.equal(merge.dropEndPointId, "new_1");
  near(merge.junction, 100, 305);
});

test("new segment: a corner is fused at the intersection of the two axes", () => {
  const [merge] = computeMergesForAnnotation({
    annotation: templated("new", [
      [100, 100],
      [100, 290],
    ]),
    annotations: [
      templated("old", [
        [120, 300],
        [400, 300],
      ]),
    ],
    meterByPx: MBP,
    reachPx: 74,
  });
  assert.equal(merge.keepId, "old");
  near(merge.junction, 100, 300);
});

test("new segment: both ends fuse with two different walls, one merge each", () => {
  const merges = computeMergesForAnnotation({
    annotation: templated("new", [
      [100, 100],
      [100, 300],
    ]),
    annotations: [
      templated("above", [
        [100, 0],
        [100, 95],
      ]),
      templated("below", [
        [100, 305],
        [100, 500],
      ]),
    ],
    meterByPx: MBP,
    reachPx: 74,
  });
  assert.deepEqual(merges.map((m) => m.keepId).sort(), ["above", "below"]);
  // Restricted to one end of the new segment.
  const one = computeMergesForAnnotation({
    annotation: templated("new", [
      [100, 100],
      [100, 300],
    ]),
    annotations: [
      templated("above", [
        [100, 0],
        [100, 95],
      ]),
      templated("below", [
        [100, 305],
        [100, 500],
      ]),
    ],
    meterByPx: MBP,
    reachPx: 74,
    endPointIds: new Set(["new_1"]),
  });
  assert.deepEqual(
    one.map((m) => m.keepId),
    ["below"]
  );
});

test("new segment: no fusion with another template, width, a T contact or beyond reach", () => {
  const created = templated("new", [
    [100, 100],
    [100, 300],
  ]);
  const none = (others, reachPx = 74) =>
    assert.deepEqual(
      computeMergesForAnnotation({
        annotation: created,
        annotations: others,
        meterByPx: MBP,
        reachPx,
      }),
      []
    );
  const below = [
    [100, 310],
    [100, 500],
  ];
  none([templated("old", below, { annotationTemplateId: "t2" })]);
  none([templated("old", below, { strokeWidth: 30 })]);
  none([wall("old", below)]);
  none([templated("old", below)], 5);
  // T contact: the new end meets the body of the wall, not one of its ends.
  none([
    templated("old", [
      [-200, 320],
      [400, 320],
    ]),
  ]);
  // Uncalibrated plan.
  assert.deepEqual(
    computeMergesForAnnotation({
      annotation: created,
      annotations: [templated("old", below)],
      meterByPx: 0,
      reachPx: 74,
    }),
    []
  );
});
