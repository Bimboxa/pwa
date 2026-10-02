import assert from "node:assert/strict";
import { test } from "node:test";
import detectCopiedSegmentAtCursor from "./detectCopiedSegmentAtCursor.js";
import {
  buildSegmentPasteDebugCase,
  restoreSegmentPasteDebugCase,
} from "./segmentPasteDebugCase.js";
import fixture from "./wallDetectionFixture.mjs";

// The fixture target is a 20 px wide vertical wall: x 250..270, y 120..300.
const vertical = (fill = "hatch", targetFill = fill, options) =>
  fixture(fill, 90, targetFill, options);
const paint = (f, x0, x1, y0, y1, rgb) => {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      f.imageData.data.set(rgb, (y * f.imageData.width + x) * 4);
};
const detect = (f, extra) => detectCopiedSegmentAtCursor({ ...f, ...extra });
const assertWall = (result, x = 260, y0 = 120, y1 = 300, label = "") => {
  assert.ok(result.match, `${label} ${result.reason}`);
  const [a, b] = result.match.placedPoints;
  assert.ok(Math.abs(a.x - x) <= 0.75, `${label} x ${a.x}`);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(Math.abs(Math.min(a.y, b.y) - y0) <= 2, `${label} start ${a.y}`);
  assert.ok(Math.abs(Math.max(a.y, b.y) - y1) <= 2, `${label} end ${b.y}`);
};

for (const fill of ["hatch", "gray", "black"]) {
  test(`${fill} wall along a colored or darker surface is detected`, () => {
    for (const rgb of [
      [128, 213, 255],
      [187, 166, 161],
    ]) {
      const f = vertical(fill);
      paint(f, 190, 250, 100, 320, rgb);
      for (const x of [252, 261, 268]) {
        assertWall(
          detect(f, { cursorImgPx: { x, y: 211 } }),
          260,
          120,
          300,
          `${rgb} cursor ${x}`
        );
      }
    }
  });
}

test("a wall drawn as two bare lines is detected from a hollow or a hatched copy", () => {
  assertWall(detect(vertical("outline")));
  assertWall(detect(vertical("hatch", "outline")));
});

test("the copied width tolerates a few pixels, not another thickness", () => {
  for (const width of [17, 23]) {
    assertWall(
      detect(vertical("hatch", "hatch", { width })),
      260,
      120,
      300,
      width
    );
    assertWall(
      detect(vertical("gray", "gray", { width })),
      260,
      120,
      300,
      width
    );
  }
  for (const width of [8, 30, 60]) {
    const result = detect(vertical("gray", "gray", { width }));
    assert.equal(result.match, null, `${width}`);
    assert.equal(result.reason, "NO_BAND");
  }
});

test("a stub shorter than two widths is created", () => {
  for (const fill of ["hatch", "gray", "outline"]) {
    const f = vertical(fill, fill, { length: 30 });
    paint(f, 250, 270, 195, 196, [0, 0, 0]);
    paint(f, 250, 270, 224, 225, [0, 0, 0]);
    assertWall(detect(f), 260, 195, 225, fill);
  }
});

test("one readable face is enough when the other side is already annotated", () => {
  const f = vertical("hatch");
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 100; y < 320; y++)
    for (let x = 269; x < 290; x++) mask[y * f.imageData.width + x] = 1;
  assertWall(detect(f, { exclusionMask: mask }));
});

test("an already annotated wall is not created twice", () => {
  const f = vertical("hatch");
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 120; y < 300; y++)
    for (let x = 250; x < 270; x++) mask[y * f.imageData.width + x] = 1;
  assert.equal(detect(f, { exclusionMask: mask }).match, null);
});

test("the axis is centered between both faces wherever the cursor is", () => {
  for (const fill of ["hatch", "gray", "black", "outline"])
    for (const x of [235, 246, 252, 256, 264, 268, 274, 285]) {
      const result = detect(vertical(fill), { cursorImgPx: { x, y: 211 } });
      assert.ok(result.match, `${fill} ${x}`);
      assert.ok(
        Math.abs(result.match.placedPoints[0].x - 260) <= 0.5,
        `${fill} cursor ${x}: ${result.match.placedPoints[0].x}`
      );
    }
});

test("extension starts at the click and stops at an opening", () => {
  for (const fill of ["hatch", "gray", "black"]) {
    const f = vertical(fill);
    paint(f, 245, 275, 200, 215, [255, 255, 255]);
    assertWall(detect(f, { cursorImgPx: { x: 260, y: 150 } }), 260, 120, 200);
    assertWall(detect(f, { cursorImgPx: { x: 260, y: 260 } }), 260, 215, 300);
    // On the opening itself the nearest piece wins.
    assertWall(detect(f, { cursorImgPx: { x: 260, y: 203 } }), 260, 120, 200);
  }
});

test("extension stops at an existing segment", () => {
  const f = vertical("gray");
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 240; y < 260; y++)
    for (let x = 200; x < 320; x++) mask[y * f.imageData.width + x] = 1;
  assertWall(detect(f, { exclusionMask: mask }), 260, 120, 240);
});

test("a T junction ends the stem at the near face of the crossing wall", () => {
  const f = vertical("hatch");
  // Crossing hatched wall above the stem: y 100..120, outlined except where
  // the stem joins it.
  for (let y = 100; y < 120; y++)
    for (let x = 150; x < 370; x++) {
      const outline =
        y === 100 || (y === 119 && (x < 251 || x > 268)) ? 0 : null;
      const value = outline ?? ((x + y) % 8 < 2 ? 40 : 255);
      f.imageData.data.set(
        [value, value, value],
        (y * f.imageData.width + x) * 4
      );
    }
  assertWall(detect(f), 260, 120, 300);
});

test("the wall wins over the blank gap between it and a nearby line", () => {
  const f = vertical("hatch");
  paint(f, 290, 291, 100, 320, [0, 0, 0]);
  for (const x of [262, 268, 273, 277])
    assertWall(
      detect(f, { cursorImgPx: { x, y: 211 } }),
      260,
      120,
      300,
      `cursor ${x}`
    );
});

test("dimensions across the acquisition window do not hide the wall", () => {
  const f = vertical("hatch");
  paint(f, 190, 250, 100, 320, [128, 213, 255]);
  paint(f, 230, 290, 208, 210, [0, 0, 255]);
  paint(f, 248, 250, 200, 220, [0, 0, 255]);
  assertWall(detect(f, { cursorImgPx: { x: 260, y: 209 } }));
});

test("failures are explained", () => {
  const far = detect(vertical("gray"), { cursorImgPx: { x: 350, y: 60 } });
  assert.equal(far.match, null);
  assert.equal(far.reason, "NO_BAND");
  const polygon = vertical("gray");
  polygon.clipboard.items[0].annotation.type = "POLYGON";
  assert.equal(detect(polygon).reason, "UNSUPPORTED_REFERENCE");
  assert.equal(
    detect({ ...vertical("gray"), baseMapId: "other" }).reason,
    "UNSUPPORTED_REFERENCE"
  );
  const traced = detect(vertical("gray"), { debug: true });
  assert.equal(traced.trace.at(-1).outcome, "accepted");
});

test("the copied orientation stays a constraint", () => {
  for (const angle of [0, 45, 75]) {
    const f = fixture("hatch", angle);
    f.pasteTransform = { rotationDeg: 0 };
    assert.equal(detect(f).match, null, `${angle}`);
  }
  const rotated = fixture("hatch", 0);
  rotated.pasteTransform = { rotationDeg: 90 };
  const [a, b] = detect(rotated).match.placedPoints;
  assert.ok(Math.abs(a.y - b.y) < 1e-9);
  assert.ok(Math.abs(a.y - 210) <= 0.75);
});

test("a debug case replays the same detection outside the browser", () => {
  const f = vertical("hatch");
  paint(f, 190, 250, 100, 320, [128, 213, 255]);
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 240; y < 260; y++)
    for (let x = 200; x < 320; x++) mask[y * f.imageData.width + x] = 1;
  const options = { ...f, exclusionMask: mask };
  const result = detect(options);
  const debugCase = JSON.parse(
    JSON.stringify(buildSegmentPasteDebugCase(options, result, 400))
  );
  assert.deepEqual(debugCase.placedPoints, result.match.placedPoints);
  assert.deepEqual(
    detect(restoreSegmentPasteDebugCase(debugCase)).match.placedPoints,
    result.match.placedPoints
  );
});

// Same drawing at `factor` bitmap pixels per reference pixel.
const upscale = (f, factor) => {
  const { width, height, data } = f.imageData;
  const scaled = new Uint8ClampedArray(width * factor * height * factor * 4);
  for (let y = 0; y < height * factor; y++)
    for (let x = 0; x < width * factor; x++) {
      const from =
        (Math.floor(y / factor) * width + Math.floor(x / factor)) * 4;
      scaled.set(data.subarray(from, from + 4), (y * width * factor + x) * 4);
    }
  return {
    ...f,
    imageData: { width: width * factor, height: height * factor, data: scaled },
    imageScale: 1 / factor,
    cursorImgPx: {
      x: f.cursorImgPx.x * factor,
      y: f.cursorImgPx.y * factor,
    },
  };
};

test("a band a few pixels thick on a coarse plan is a valid reference", () => {
  for (const fill of ["gray", "black", "outline"]) {
    // 20 cm at 5 cm per pixel: four pixels.
    const f = vertical(fill, fill, { sourceWidth: 4, width: 4 });
    f.clipboard.items[0].annotation = {
      type: "POLYLINE",
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      baseMapId: "plan",
    };
    f.meterByPx = 0.05;
    for (const x of [255, 260, 266])
      assertWall(
        detect(f, { cursorImgPx: { x, y: 211 } }),
        260,
        120,
        300,
        `${fill} cursor ${x}`
      );
  }
  const hairline = vertical("black", "black", { sourceWidth: 4, width: 4 });
  hairline.clipboard.items[0].annotation.strokeWidth = 1;
  assert.equal(detect(hairline).reason, "UNSUPPORTED_REFERENCE");
});

test("results do not depend on the resolution of a calibrated plan", () => {
  for (const fill of ["hatch", "gray"]) {
    const f = vertical(fill);
    f.meterByPx = 0.01;
    paint(f, 190, 250, 100, 320, [128, 213, 255]);
    paint(f, 245, 275, 200, 215, [255, 255, 255]);
    for (const y of [150, 260]) {
      const cursor = { cursorImgPx: { x: 262, y } };
      const [a, b] = detect(f, cursor).match.placedPoints;
      for (const factor of [2, 3, 5]) {
        const scaled = detect(upscale({ ...f, ...cursor }, factor));
        assert.ok(scaled.match, `${fill} ×${factor} ${scaled.reason}`);
        const [c, d] = scaled.match.placedPoints;
        for (const [p, q] of [
          [a, c],
          [b, d],
        ])
          assert.ok(
            Math.hypot(p.x - q.x, p.y - q.y) <= 1,
            `${fill} ×${factor} y${y}: ${JSON.stringify([a, b, c, d])}`
          );
      }
    }
  }
});
