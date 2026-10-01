import assert from "node:assert/strict";
import { test } from "node:test";
import detectWallHoverCandidate from "./detectWallHoverCandidate.js";

function fixture(fill = "hatch", angle = 0, targetFill = fill, options = {}) {
  const image = {
    width: 420,
    height: 380,
    data: new Uint8ClampedArray(420 * 380 * 4).fill(255),
  };
  const draw = (cx, cy, length, width, degrees, material) => {
    const a = (degrees * Math.PI) / 180,
      ux = Math.cos(a),
      uy = Math.sin(a);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        const along = dx * ux + dy * uy,
          across = -dx * uy + dy * ux;
        if (Math.abs(along) > length / 2 || Math.abs(across) > width / 2)
          continue;
        let value = material === "black" ? 0 : material === "gray" ? 155 : 255;
        if (material === "hatch")
          value = (x + y + (options.phase ?? 0)) % 8 < 2 ? 40 : 255;
        if (material === "grid") value = x % 8 < 2 || y % 8 < 2 ? 40 : 255;
        if (material !== "blank" && Math.abs(across) > width / 2 - 1) value = 0;
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      }
  };
  draw(50, 120, 160, 20, 90, fill);
  draw(260, 210, options.length ?? 180, options.width ?? 20, angle, targetFill);
  const clipboard = {
    sourceCenter: { x: 50, y: 120 },
    items: [
      {
        annotation: { type: "POLYLINE", strokeWidth: 20, baseMapId: "plan" },
        basePoints: [
          { x: 50, y: 40, type: "square" },
          { x: 50, y: 200, type: "square" },
        ],
      },
    ],
  };
  return {
    imageData: image,
    clipboard,
    cursorImgPx: { x: 261, y: 211 },
    baseMapId: "plan",
  };
}

for (const fill of ["hatch", "black", "gray"]) {
  for (const angle of [0, 90, 33]) {
    test(`${fill} wall at ${angle} degrees adapts length and orientation`, () => {
      const f = fixture(fill, angle);
      const result = detectWallHoverCandidate(f);
      assert.equal(result?.matches.length, 1);
      const [a, b] = result.matches[0].placedPoints;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      assert.ok(Math.abs(length - 180) < 12, `length ${length}`);
      const actual = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      assert.ok(
        Math.abs(Math.cos(((actual - angle) * Math.PI) / 180)) > 0.998,
        `angle ${actual}`
      );
      assert.ok(Math.hypot((a.x + b.x) / 2 - 260, (a.y + b.y) / 2 - 210) < 5);
    });
  }
}

test("source and already annotated walls are excluded", () => {
  const f = fixture();
  assert.equal(
    detectWallHoverCandidate({ ...f, cursorImgPx: { x: 50, y: 120 } }).matches
      .length,
    0
  );
  const mask = new Uint8Array(f.imageData.width * f.imageData.height);
  for (let y = 198; y < 222; y++)
    for (let x = 169; x < 351; x++) mask[y * f.imageData.width + x] = 1;
  assert.equal(
    detectWallHoverCandidate({ ...f, exclusionMask: mask }).matches.length,
    0
  );
});

test("does not match a solid or blank wall to a hatch reference", () => {
  for (const target of ["gray", "black", "blank"]) {
    assert.equal(
      detectWallHoverCandidate(fixture("hatch", 0, target)).matches.length,
      0,
      target
    );
  }
});

test("rejects incompatible thickness and broad filled surfaces", () => {
  for (const width of [5, 50, 100]) {
    assert.equal(
      detectWallHoverCandidate(fixture("gray", 0, "gray", { width })).matches
        .length,
      0,
      `${width}`
    );
  }
});

test("openings split a wall and masks stop extension", () => {
  for (const masked of [false, true]) {
    const f = fixture("black");
    const mask = new Uint8Array(f.imageData.width * f.imageData.height);
    for (let y = 198; y < 223; y++)
      for (let x = 300; x < 312; x++) {
        if (masked) mask[y * f.imageData.width + x] = 1;
        else
          f.imageData.data.fill(
            255,
            (y * f.imageData.width + x) * 4,
            (y * f.imageData.width + x) * 4 + 4
          );
      }
    const result = detectWallHoverCandidate({
      ...f,
      exclusionMask: masked ? mask : null,
    });
    assert.equal(result.matches.length, 1);
    const xs = result.matches[0].placedPoints.map((p) => p.x);
    assert.ok(Math.max(...xs) <= 301, `${masked}: ${xs}`);
    assert.ok(Math.min(...xs) < 172);
  }
});

test("reference coordinates, physical widths and strip side round trip", () => {
  const f = fixture("gray");
  f.imageScale = 2;
  f.imageOffset = { x: 17, y: 23 };
  f.meterByPx = 0.005;
  const it = f.clipboard.items[0];
  it.basePoints = it.basePoints.map((p) => ({
    x: p.x * 2 + 17,
    y: p.y * 2 + 23,
  }));
  it.annotation.strokeWidth = 20;
  it.annotation.strokeWidthUnit = "CM";
  const result = detectWallHoverCandidate(f);
  assert.equal(result.matches.length, 1);
  const points = result.matches[0].placedPoints;
  assert.ok(Math.abs(points[0].y - 443) < 4);
  const strip = fixture("gray");
  strip.clipboard.items[0].annotation.type = "STRIP";
  strip.clipboard.items[0].stripWidthPx = 20;
  strip.clipboard.items[0].stripOrientation = -1;
  strip.clipboard.items[0].basePoints = [
    { x: 40, y: 40 },
    { x: 40, y: 200 },
  ];
  const match = detectWallHoverCandidate(strip).matches[0];
  assert.ok(match);
  const [a, b] = match.placedPoints;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len,
    ny = (b.x - a.x) / len;
  assert.ok(Math.abs((a.y + b.y) / 2 - 10 * ny - 210) < 2);
  assert.ok(Math.abs((a.x + b.x) / 2 - 10 * nx - 260) < 2);
});

test("rectangular polygons publish a resized closed footprint", () => {
  const f = fixture("black");
  f.clipboard.items[0].annotation.type = "POLYGON";
  f.clipboard.items[0].basePoints = [
    { x: 40, y: 40 },
    { x: 60, y: 40 },
    { x: 60, y: 200 },
    { x: 40, y: 200 },
  ];
  const result = detectWallHoverCandidate(f);
  assert.equal(result.matches[0].placedPoints.length, 4);
  assert.equal(result.matches[0].polylines[0].closed, true);
});

test("unsupported references and cross-map pastes retain general detection", () => {
  assert.equal(detectWallHoverCandidate(fixture("blank")), null);
  assert.equal(
    detectWallHoverCandidate({ ...fixture(), baseMapId: "other" }),
    null
  );
  const f = fixture();
  f.clipboard.items[0].annotation.type = "MARKER";
  assert.equal(detectWallHoverCandidate(f), null);
});

test("colored dimensions crossing a wall do not split the candidate", () => {
  for (const fill of ["hatch", "gray", "black"]) {
    const f = fixture(fill);
    for (let y = 175; y < 245; y++)
      for (let x = 295; x < 299; x++) {
        const i = (y * f.imageData.width + x) * 4;
        f.imageData.data[i] = 0;
        f.imageData.data[i + 1] = 0;
        f.imageData.data[i + 2] = 255;
      }
    const result = detectWallHoverCandidate(f);
    assert.equal(result.matches.length, 1);
    const [a, b] = result.matches[0].placedPoints;
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 180) < 5);
  }
});

test("shorter walls and small rotations remain detectable", () => {
  for (const fill of ["hatch", "gray", "black"]) {
    const result = detectWallHoverCandidate(
      fixture(fill, 31, fill, { length: 90 })
    );
    assert.equal(result.matches.length, 1);
    const [a, b] = result.matches[0].placedPoints;
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 90) < 10);
  }
});

test("different hatch phase is accepted but a grid fill is rejected", () => {
  const f = fixture("hatch", 0, "hatch", { phase: 3 });
  // Change only the target phase; keep the source independent.
  for (let y = 201; y < 219; y++)
    for (let x = 170; x < 350; x++) {
      const value = (x + y + 6) % 8 < 2 ? 40 : 255;
      const i = (y * f.imageData.width + x) * 4;
      f.imageData.data[i] =
        f.imageData.data[i + 1] =
        f.imageData.data[i + 2] =
          value;
    }
  assert.equal(detectWallHoverCandidate(f).matches.length, 1);
  assert.equal(
    detectWallHoverCandidate(fixture("hatch", 0, "grid")).matches.length,
    0
  );
});
