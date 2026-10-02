import assert from "node:assert/strict";
import { test } from "node:test";
import prepareCopiedSegmentCreation, {
  isCopiedSegment,
  joinCopiedSegment,
} from "./prepareCopiedSegmentCreation.js";
import fixture from "./wallDetectionFixture.mjs";

for (const fill of ["hatch", "gray", "black"]) {
  test(`Space searches a two-width radius away from the mouse for ${fill}`, () => {
    const f = fixture(fill, 90);
    const plan = prepareCopiedSegmentCreation({
      ...f,
      cursorImgPx: { x: 295, y: 310 },
    });
    assert.ok(plan);
    const [a, b] = plan.match.placedPoints;
    assert.ok(Math.abs(a.x - 260) < 2);
    assert.ok(Math.abs(Math.abs(a.y - b.y) - 180) < 3);
    // A square window would include this target, but the search circle cannot.
    assert.equal(
      prepareCopiedSegmentCreation({ ...f, cursorImgPx: { x: 306, y: 325 } }),
      null
    );
  });
}

test("search radius follows band width and bitmap scale, independently of length and zoom", () => {
  const f = fixture("gray", 90);
  for (const length of [100, 160]) {
    f.clipboard.items[0].basePoints = [
      { x: 50, y: 120 - length / 2 },
      { x: 50, y: 120 + length / 2 },
    ];
    for (const smartZoom of [0.25, 8]) {
      assert.ok(
        prepareCopiedSegmentCreation({
          ...f,
          smartZoom,
          cursorImgPx: { x: 295, y: 210 },
        })
      );
      assert.equal(
        prepareCopiedSegmentCreation({
          ...f,
          smartZoom,
          cursorImgPx: { x: 320, y: 210 },
        }),
        null
      );
    }
  }
  f.imageScale = 2;
  f.meterByPx = 0.005;
  f.clipboard.items[0].annotation.strokeWidth = 20;
  f.clipboard.items[0].annotation.strokeWidthUnit = "CM";
  f.clipboard.items[0].basePoints.forEach((p) => {
    p.x *= 2;
    p.y *= 2;
  });
  assert.ok(
    prepareCopiedSegmentCreation({ ...f, cursorImgPx: { x: 295, y: 210 } })
  );
  assert.equal(
    prepareCopiedSegmentCreation({ ...f, cursorImgPx: { x: 320, y: 210 } }),
    null
  );
});

test("the nearest compatible band wins instead of the last hover candidate", () => {
  const f = fixture("gray", 90);
  for (let y = 120; y < 300; y++)
    for (let x = 250; x < 270; x++) {
      const src = (y * 420 + x) * 4;
      f.imageData.data.set(
        f.imageData.data.slice(src, src + 4),
        (y * 420 + x + 50) * 4
      );
    }
  for (const [cursorX, expected] of [
    [290, 310],
    [280, 260],
  ]) {
    const plan = prepareCopiedSegmentCreation({
      ...f,
      cursorImgPx: { x: cursorX, y: 210 },
    });
    assert.ok(Math.abs(plan.match.placedPoints[0].x - expected) < 2);
  }
});

const ann = { type: "POLYLINE", strokeWidth: 20 };
const match = {
  placedPoints: [
    { x: 100, y: 100 },
    { x: 100, y: 200 },
  ],
};
const neighbor = (points) => ({
  ...ann,
  id: "neighbor",
  points: points.map((p, i) => ({ ...p, id: `p${i}` })),
});

test("T junction extends only along the copied axis", () => {
  const result = joinCopiedSegment({
    match,
    annotation: ann,
    meterByPx: 0.01,
    annotations: [
      neighbor([
        { x: 40, y: 220 },
        { x: 160, y: 220 },
      ]),
    ],
  });
  assert.deepEqual(result.match.placedPoints, [
    { x: 100, y: 100 },
    { x: 100, y: 211 },
  ]);
  assert.equal(result.junctionEdits.length, 0);
});

test("L junction forks only the editable neighbor endpoint", () => {
  const annotations = [
    neighbor([
      { x: 20, y: 220 },
      { x: 100, y: 220 },
    ]),
  ];
  const result = joinCopiedSegment({
    match,
    annotation: ann,
    meterByPx: 0.01,
    annotations,
    canEditAnnotation: () => true,
  });
  assert.equal(result.junctionEdits.length, 1);
  assert.deepEqual(result.junctionEdits[0], {
    annotationId: "neighbor",
    pointId: "p1",
    x: 110,
    y: 220,
    before: { x: 100, y: 220 },
  });
  assert.equal(
    joinCopiedSegment({ match, annotation: ann, meterByPx: 0.01, annotations })
      .junctionEdits.length,
    0
  );
});

test("collinear gaps join, while distant or laterally offset segments do not", () => {
  for (const [x, y, expected] of [
    [100, 210, 210],
    [100, 240, 200],
    [104, 210, 200],
  ]) {
    const result = joinCopiedSegment({
      match,
      annotation: ann,
      meterByPx: 0.01,
      annotations: [
        neighbor([
          { x, y },
          { x, y: y + 100 },
        ]),
      ],
    });
    assert.equal(result.match.placedPoints[1].y, expected);
  }
});

test("strip joints use the one-sided band and canonical CM width", () => {
  const strip = {
    type: "STRIP",
    strokeWidth: 20,
    strokeWidthUnit: "CM",
    stripOrientation: 1,
  };
  const result = joinCopiedSegment({
    match,
    annotation: strip,
    meterByPx: 0.01,
    annotations: [
      neighbor([
        { x: 20, y: 220 },
        { x: 90, y: 220 },
      ]),
    ],
    canEditAnnotation: () => true,
  });
  assert.equal(result.junctionEdits[0].x, 100);
  assert.equal(result.match.placedPoints[1].y, 211);
});

test("only a single straight copied segment uses this workflow", () => {
  const f = fixture();
  assert.ok(isCopiedSegment(f.clipboard));
  f.clipboard.items[0].annotation.type = "STRIP";
  assert.ok(isCopiedSegment(f.clipboard));
  f.clipboard.items[0].basePoints[0].type = "circle";
  assert.equal(isCopiedSegment(f.clipboard), false);
  assert.equal(prepareCopiedSegmentCreation(f), null);
});

for (const type of ["POLYLINE", "STRIP"]) {
  for (const fill of ["hatch", "gray", "black"]) {
    test(`a short copied ${type} learns ${fill} and detects its unannotated continuation`, () => {
      for (const length of [20, 30, 40, 50]) {
        const f = fixture(fill, 90);
        const item = f.clipboard.items[0];
        item.annotation.type = type;
        item.annotation.stripOrientation = 1;
        const x = type === "STRIP" ? 60 : 50;
        item.basePoints = [
          { x, y: 130 },
          { x, y: 130 + length },
        ];
        const mask = new Uint8Array(f.imageData.width * f.imageData.height);
        for (let y = 130; y < 130 + length; y++)
          for (let x = 40; x < 60; x++) mask[y * f.imageData.width + x] = 1;
        const plan = prepareCopiedSegmentCreation({
          ...f,
          exclusionMask: mask,
          cursorImgPx: { x: 50, y: 95 },
        });
        assert.ok(plan, `${type} ${fill}: length ${length}, width 20`);
        const [a, b] = plan.match.placedPoints;
        assert.ok(Math.abs(a.y - 40) < 2);
        assert.ok(
          Math.abs(b.y - 130) < 2,
          `must stop at the copied footprint: ${b.y}`
        );
      }
    });
  }
}
