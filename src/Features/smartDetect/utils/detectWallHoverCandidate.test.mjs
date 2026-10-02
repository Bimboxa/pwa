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
          value =
            (x + y + (options.phase ?? 0)) % 8 < 2
              ? (options.hatchInk ?? 40)
              : 255;
        if (material === "grid") value = x % 8 < 2 || y % 8 < 2 ? 40 : 255;
        if (material !== "blank" && Math.abs(across) > width / 2 - 1) value = 0;
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      }
  };
  draw(50, 120, 160, options.sourceWidth ?? 20, 90, fill);
  draw(260, 210, options.length ?? 180, options.width ?? 20, angle, targetFill);
  const clipboard = {
    sourceCenter: { x: 50, y: 120 },
    items: [
      {
        annotation: {
          type: "POLYLINE",
          strokeWidth: options.sourceWidth ?? 20,
          baseMapId: "plan",
        },
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
    pasteTransform: { rotationDeg: angle - 90 },
  };
}

for (const fill of ["hatch", "black", "gray"]) {
  for (const angle of [0, 90, 33]) {
    test(`${fill} wall at ${angle} degrees follows the explicitly rotated source and adapts length`, () => {
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
  assert.equal(detectWallHoverCandidate(fixture("blank")).matches.length, 0);
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

test("unrotated copy only detects parallel walls, never a diagonal or perpendicular wall", () => {
  for (const fill of ["hatch", "black", "gray"]) {
    for (const angle of [0, 45, 75, 81, 99, 105, 135]) {
      const f = fixture(fill, angle);
      f.pasteTransform = { rotationDeg: 0 };
      assert.equal(
        detectWallHoverCandidate(f).matches.length,
        0,
        `${fill} ${angle}`
      );
    }
    const f = fixture(fill, 90);
    f.pasteTransform = { rotationDeg: 0 };
    const [a, b] = detectWallHoverCandidate(f).matches[0].placedPoints;
    assert.ok(Math.abs(a.x - b.x) < 1e-9);
  }
});

test("R allows a perpendicular wall without enabling arbitrary orientations", () => {
  const f = fixture("hatch", 0);
  assert.equal(
    detectWallHoverCandidate({ ...f, pasteTransform: { rotationDeg: 0 } })
      .matches.length,
    0
  );
  const [a, b] = detectWallHoverCandidate({
    ...f,
    pasteTransform: { rotationDeg: 90 },
  }).matches[0].placedPoints;
  assert.ok(Math.abs(a.y - b.y) < 1e-9);
});

test("transverse signatures reject equal-density ink arranged in different layers", () => {
  const f = fixture("black");
  for (let y = 40; y < 200; y++)
    for (let x = 40; x < 60; x++) {
      const value = x < 45 || x >= 55 ? 0 : 255;
      const i = (y * f.imageData.width + x) * 4;
      f.imageData.data[i] =
        f.imageData.data[i + 1] =
        f.imageData.data[i + 2] =
          value;
    }
  for (let y = 200; y < 220; y++)
    for (let x = 170; x < 350; x++) {
      const value = y === 200 || y === 219 || (y >= 206 && y < 214) ? 0 : 255;
      const i = (y * f.imageData.width + x) * 4;
      f.imageData.data[i] =
        f.imageData.data[i + 1] =
        f.imageData.data[i + 2] =
          value;
    }
  assert.equal(detectWallHoverCandidate(f).matches.length, 0);
});

test("equivalent parallel wall remains stable as the cursor moves across it", () => {
  const f = fixture("hatch", 90);
  f.pasteTransform = { rotationDeg: 0 };
  for (const x of [255, 258, 261, 264, 268]) {
    const result = detectWallHoverCandidate({
      ...f,
      cursorImgPx: { x, y: 210 },
    });
    assert.equal(result.matches.length, 1, `${x}`);
    const [a, b] = result.matches[0].placedPoints;
    assert.ok(Math.abs(a.x - b.x) < 1e-9);
    assert.ok(Math.abs(a.x - 260) <= 1);
    assert.ok(Math.abs(Math.abs(a.y - b.y) - 180) <= 3);
  }
});

test("acquires a clean seed beside a dimension label and extends through it", () => {
  for (const fill of ["hatch", "black", "gray"]) {
    for (const cursorX of [248, 260, 270]) {
      const f = fixture(fill);
      // A blue dimension label occludes a span longer than the old 8px limit.
      for (let y = 198; y < 222; y++)
        for (let x = 247; x < 275; x++) {
          const i = (y * f.imageData.width + x) * 4;
          f.imageData.data[i] = 20;
          f.imageData.data[i + 1] = 30;
          f.imageData.data[i + 2] = 230;
        }
      const result = detectWallHoverCandidate({
        ...f,
        cursorImgPx: { x: cursorX, y: 210 },
      });
      assert.equal(result?.matches.length, 1, `${fill}, cursor ${cursorX}`);
      const [a, b] = result.matches[0].placedPoints;
      assert.ok(
        Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 180) < 5,
        `${fill}: ${JSON.stringify([a, b])}`
      );
    }
  }
});

test("extension crosses thin black drafting lines but stops at real openings", () => {
  const f = fixture("hatch");
  for (let y = 198; y < 222; y++)
    for (let x = 290; x < 294; x++) {
      const i = (y * f.imageData.width + x) * 4;
      f.imageData.data[i] =
        f.imageData.data[i + 1] =
        f.imageData.data[i + 2] =
          0;
    }
  const result = detectWallHoverCandidate(f);
  assert.equal(result?.matches.length, 1);
  const [a, b] = result.matches[0].placedPoints;
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 180) < 5);
});

test("canonical CM strips use the rendered width without legacy clipboard fields", () => {
  for (const stripOrientation of [-1, 1]) {
    const f = fixture("hatch", 90);
    f.imageScale = 2;
    f.imageOffset = { x: 17, y: 23 };
    f.meterByPx = 0.005;
    const item = f.clipboard.items[0];
    item.annotation = {
      type: "STRIP",
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      stripOrientation,
    };
    item.basePoints = item.basePoints.map((p) => ({
      x: (p.x + stripOrientation * 10) * 2 + 17,
      y: p.y * 2 + 23,
    }));
    const match = detectWallHoverCandidate(f)?.matches[0];
    assert.ok(match, `orientation ${stripOrientation}`);
    const [a, b] = match.placedPoints;
    assert.ok(Math.abs(a.x - (260 + stripOrientation * 10) * 2 - 17) < 3);
    assert.ok(Math.abs(Math.abs(a.y - b.y) - 360) < 5);
  }
});

test("material description tolerates a slightly misplaced source annotation", () => {
  for (const fill of ["hatch", "gray", "black"]) {
    for (const dx of [-2, -1, 1, 2]) {
      const f = fixture(fill, 90);
      f.clipboard.items[0].basePoints.forEach((p) => {
        p.x += dx;
      });
      const match = detectWallHoverCandidate(f)?.matches[0];
      assert.ok(match, `${fill}, source offset ${dx}`);
      const [a, b] = match.placedPoints;
      assert.ok(Math.abs(a.x - 260) <= 1);
      assert.ok(Math.abs(Math.abs(a.y - b.y) - 180) <= 3);
    }
  }
});

test("a pale narrow hatched region ends at a solid gray surface or white opening", () => {
  for (const sourceOffset of [-2, -1, 0, 1, 2]) {
    const f = fixture("hatch", 90, "hatch", {
      sourceWidth: 13,
      width: 13,
      hatchInk: 160,
    });
    f.clipboard.items[0].basePoints.forEach((p) => {
      p.x += sourceOffset;
    });
    for (let y = 0; y < 120; y++)
      for (let x = 230; x < 290; x++) {
        const i = (y * f.imageData.width + x) * 4;
        f.imageData.data[i] =
          f.imageData.data[i + 1] =
          f.imageData.data[i + 2] =
            172;
      }
    const match = detectWallHoverCandidate(f)?.matches[0];
    assert.ok(match, `source offset ${sourceOffset}`);
    const ys = match.placedPoints.map((p) => p.y);
    assert.ok(Math.abs(Math.min(...ys) - 120) < 2, `start ${ys}`);
    assert.ok(Math.abs(Math.max(...ys) - 300) < 2, `end ${ys}`);
  }
});
