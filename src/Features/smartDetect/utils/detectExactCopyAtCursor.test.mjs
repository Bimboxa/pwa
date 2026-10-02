import assert from "node:assert/strict";
import { test } from "node:test";
import detectExactCopyAtCursor from "./detectExactCopyAtCursor.js";
import prepareCopiedSegmentCreation from "./prepareCopiedSegmentCreation.js";
import fixture from "./wallDetectionFixture.mjs";

// The copy is the whole source wall: x 40..60, y 40..200 (160 long). With
// `length: 160` the target is the same wall at x 250..270, y 130..290.
const twin = (fill = "hatch", options) =>
  fixture(fill, 90, fill, { length: 160, ...options });
const detect = (f, extra) => detectExactCopyAtCursor({ ...f, ...extra });
const ys = (match) => match.placedPoints.map((p) => p.y).sort((a, b) => a - b);

for (const fill of ["hatch", "gray", "black", "outline"]) {
  test(`an identical ${fill} wall receives the copy unchanged, ends on its ends`, () => {
    for (const [x, y] of [
      [260, 210],
      [252, 200],
      [270, 222],
      [280, 190],
    ]) {
      const result = detect(twin(fill), { cursorImgPx: { x, y } });
      assert.ok(result.match, `${fill} ${x},${y} ${result.reason}`);
      const [a, b] = result.match.placedPoints;
      assert.ok(Math.abs(a.x - 260) <= 0.5, `${fill} ${x},${y}: x ${a.x}`);
      assert.ok(Math.abs(a.x - b.x) < 1e-9);
      const [y0, y1] = ys(result.match);
      assert.ok(Math.abs(y1 - y0 - 160) < 1e-6, "length is kept");
      assert.ok(Math.abs(y0 - 130) <= 1, `${fill} ${x},${y}: start ${y0}`);
    }
  });
}

test("a copy shorter than the wall keeps its length and lands at the cursor", () => {
  const f = fixture("hatch", 90);
  f.clipboard.items[0].basePoints = [
    { x: 50, y: 100 },
    { x: 50, y: 140 },
  ];
  for (const y of [170, 210, 250]) {
    const result = detect(f, { cursorImgPx: { x: 264, y } });
    assert.ok(result.match, `${y} ${result.reason}`);
    const [y0, y1] = ys(result.match);
    assert.ok(Math.abs(y1 - y0 - 40) < 1e-6);
    assert.ok(Math.abs((y0 + y1) / 2 - y) <= 1.5, `center ${(y0 + y1) / 2}`);
    assert.ok(Math.abs(result.match.placedPoints[0].x - 260) <= 0.5);
  }
});

test("another drawing, an empty area or an annotated wall is not a copy", () => {
  assert.equal(
    detect(fixture("hatch", 90, "gray", { length: 160 })).reason,
    "NO_SIGNATURE"
  );
  assert.equal(
    detect(twin(), { cursorImgPx: { x: 150, y: 330 } }).reason,
    "NO_SIGNATURE"
  );
  const f = twin();
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 130; y < 290; y++)
    for (let x = 250; x < 270; x++) mask[y * f.imageData.width + x] = 1;
  assert.equal(detect(f, { exclusionMask: mask }).reason, "NO_SIGNATURE");
  const polygon = twin();
  polygon.clipboard.items[0].annotation.type = "POLYGON";
  assert.equal(detect(polygon).reason, "UNSUPPORTED_REFERENCE");
});

test("the copied orientation stays a constraint, R turns the copy", () => {
  const horizontal = fixture("hatch", 0, "hatch", { length: 160 });
  assert.equal(
    detect({ ...horizontal, pasteTransform: { rotationDeg: 0 } }).reason,
    "NO_SIGNATURE"
  );
  const { match } = detect(horizontal);
  assert.ok(match);
  const [a, b] = match.placedPoints;
  assert.ok(Math.abs(a.y - b.y) < 1e-9);
  assert.ok(Math.abs(a.y - 210) <= 0.5);
  assert.ok(Math.abs(Math.abs(a.x - b.x) - 160) < 1e-6);
  assert.ok(Math.abs(Math.min(a.x, b.x) - 180) <= 1);
});

test("a strip copy keeps its control points on the copied edge", () => {
  for (const stripOrientation of [-1, 1]) {
    const f = twin("gray");
    const item = f.clipboard.items[0];
    item.annotation = {
      type: "STRIP",
      strokeWidth: 20,
      stripOrientation,
      baseMapId: "plan",
    };
    item.basePoints = item.basePoints.map((p) => ({
      ...p,
      x: p.x + stripOrientation * 10,
    }));
    const { match } = detect(f);
    assert.ok(match, `${stripOrientation}`);
    assert.ok(
      Math.abs(match.placedPoints[0].x - (260 + stripOrientation * 10)) <= 0.5,
      `${stripOrientation}: ${match.placedPoints[0].x}`
    );
  }
});

test("results do not depend on the resolution of a calibrated plan", () => {
  const f = twin("hatch");
  f.meterByPx = 0.01;
  const reference = ys(detect(f).match);
  const factor = 3;
  const { width, height, data } = f.imageData;
  const scaled = new Uint8ClampedArray(width * factor * height * factor * 4);
  for (let y = 0; y < height * factor; y++)
    for (let x = 0; x < width * factor; x++) {
      const from =
        (Math.floor(y / factor) * width + Math.floor(x / factor)) * 4;
      scaled.set(data.subarray(from, from + 4), (y * width * factor + x) * 4);
    }
  const result = detect({
    ...f,
    imageData: { width: width * factor, height: height * factor, data: scaled },
    imageScale: 1 / factor,
    cursorImgPx: { x: 261 * factor, y: 211 * factor },
  });
  assert.ok(result.match, result.reason);
  const found = ys(result.match);
  assert.ok(Math.abs(found[0] - reference[0]) <= 1);
  assert.ok(Math.abs(found[1] - reference[1]) <= 1);
  assert.ok(Math.abs(result.match.placedPoints[0].x - 260) <= 0.5);
});

test("an exact copy is not stretched to its neighbors", () => {
  const f = twin("gray");
  const plan = prepareCopiedSegmentCreation({
    ...f,
    exactCopy: true,
    meterByPx: 0.01,
    annotations: [
      {
        id: "neighbor",
        type: "POLYLINE",
        strokeWidth: 20,
        points: [
          { id: "a", x: 200, y: 295 },
          { id: "b", x: 320, y: 295 },
        ],
      },
    ],
    canEditAnnotation: () => true,
  });
  assert.ok(plan.match);
  assert.deepEqual(plan.junctionEdits, []);
  const [y0, y1] = ys(plan.match);
  assert.ok(Math.abs(y1 - y0 - 160) < 1e-6);
});
