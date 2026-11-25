import assert from "node:assert/strict";
import { test } from "node:test";

import buildWallLineMasks from "./buildWallLineMasks.js";
import detectRoomAtPoint from "./detectRoomAtPoint.js";

const WIDTH = 420;
const HEIGHT = 300;
// 1 px = 1 cm: the test rooms are about 2 m x 1.5 m, walls 4 cm thick
const METER_BY_PX = 0.01;

// Raster plan: `rects` are ink boxes [x0, y0, x1, y1) and `inks` extra
// predicates, both expressed in a frame rotated by `angleDeg` around the
// image centre.
function plan({ rects = [], inks = [], redRects = [], angleDeg = 0 }) {
  const imageData = {
    width: WIDTH,
    height: HEIGHT,
    data: new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255),
  };
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = x + 0.5 - WIDTH / 2;
      const dy = y + 0.5 - HEIGHT / 2;
      const u = dx * cos + dy * sin + WIDTH / 2;
      const v = -dx * sin + dy * cos + HEIGHT / 2;
      const ink =
        rects.some(
          ([x0, y0, x1, y1]) => u >= x0 && u < x1 && v >= y0 && v < y1
        ) || inks.some((fn) => fn(u, v));
      const red = redRects.some(
        ([x0, y0, x1, y1]) => u >= x0 && u < x1 && v >= y0 && v < y1
      );
      if (!ink && !red) continue;
      const i = (y * WIDTH + x) * 4;
      imageData.data[i] = ink ? 0 : 230;
      imageData.data[i + 1] = imageData.data[i + 2] = 0;
    }
  }
  return imageData;
}

function detect(imageData, seed, { angleDeg = 0, ...options } = {}) {
  const {
    shape,
    baseRectangle,
    meterByImagePx = METER_BY_PX,
    ...maskOptions
  } = options;
  const masks = buildWallLineMasks({
    imageData,
    meterByImagePx,
    angleRad: (angleDeg * Math.PI) / 180,
    ...maskOptions,
  });
  return detectRoomAtPoint({ masks, seed, shape, baseRectangle });
}

function getArea(points) {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum / 2);
}

function getBbox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// room interior: x 54..250, y 44..200 (walls 4 px thick)
const LEFT = [50, 40, 54, 204];
const RIGHT = [250, 40, 254, 204];
const TOP = [50, 40, 254, 44];
const BOTTOM = [50, 200, 254, 204];
const ROOM_BBOX = [54, 44, 250, 200];

test("closed rectangular room: sides on the inner faces of the walls", () => {
  const result = detect(plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] }), {
    x: 100,
    y: 150,
  });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("a door in a wall does not leak, even when the click faces it", () => {
  const rects = [
    LEFT,
    RIGHT,
    BOTTOM,
    [50, 40, 120, 44], // top wall, door 120..160
    [160, 40, 254, 44],
    [20, 10, 400, 14], // another wall further up, behind the door
  ];
  const result = detect(plan({ rects }), { x: 140, y: 120 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("text, door arc, dashed line and a short furniture line are ignored", () => {
  const inks = [
    // text-like short strokes
    (u, v) => u >= 90 && u < 150 && v >= 100 && v < 112 && (u | 0) % 6 < 2,
    // door arc (quarter circle, radius 40)
    (u, v) => {
      const r = Math.hypot(u - 54, v - 160);
      return r >= 39 && r < 41 && u > 54 && v < 160;
    },
    // dashed line across the room
    (u, v) => v >= 130 && v < 132 && u >= 54 && u < 250 && (u | 0) % 16 < 9,
    // furniture line, a quarter of the room width, floating
    (u, v) => v >= 80 && v < 82 && u >= 170 && u < 220,
  ];
  const result = detect(plan({ rects: [LEFT, RIGHT, TOP, BOTTOM], inks }), {
    x: 190,
    y: 110,
  });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

// L room: the rectangle above + a leg x 250..350, y 120..200
const L_RECTS = [
  LEFT,
  TOP,
  [250, 40, 254, 120], // right wall, upper part only
  [250, 116, 354, 120], // leg top
  [350, 116, 354, 204], // leg right
  [50, 200, 354, 204], // bottom
];
const L_AREA = 196 * 156 + 100 * 80;

for (const [name, seed] of [
  ["main part", { x: 100, y: 80 }],
  ["leg", { x: 300, y: 160 }],
]) {
  // at 1 cm / px the leg (0.8 m) is no wider than a door: L mode only
  test(`L mode, L room clicked in its ${name}: union of rectangles`, () => {
    const result = detect(plan({ rects: L_RECTS }), seed, { shape: "L" });
    assert.equal(result.points?.length, 6);
    assert.deepEqual(getBbox(result.points), [54, 44, 350, 200]);
    assert.equal(getArea(result.points), L_AREA);
  });

  // at 3 cm / px the leg is 2.4 m wide: found in AUTO mode
  test(`AUTO mode, large L room clicked in its ${name}`, () => {
    const result = detect(plan({ rects: L_RECTS }), seed, {
      meterByImagePx: 0.03,
    });
    assert.equal(result.points?.length, 6);
    assert.deepEqual(getBbox(result.points), [54, 44, 350, 200]);
    assert.equal(getArea(result.points), L_AREA);
  });
}

test("rotated plan: detection in the ortho frame", () => {
  const angleDeg = 15;
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM], angleDeg });
  const result = detect(imageData, { x: 160, y: 120 }, { angleDeg });
  assert.equal(result.points?.length, 4);
  const area = getArea(result.points);
  assert.ok(Math.abs(area - 196 * 156) < 0.04 * 196 * 156, `area ${area}`);
  const [p, q] = result.points;
  const edgeDeg = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  const offAxis = (((edgeDeg - angleDeg) % 90) + 90) % 90;
  assert.ok(Math.min(offAxis, 90 - offAxis) < 0.01, `edge angle ${edgeDeg}`);
});

test("open area: no polygon", () => {
  const result = detect(plan({ rects: [LEFT, TOP] }), { x: 100, y: 150 });
  assert.equal(result.points, null);
  assert.equal(result.reason, "OPEN");
});

test("click on a wall: no polygon", () => {
  const result = detect(plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] }), {
    x: 52,
    y: 150,
  });
  assert.equal(result.points, null);
  assert.equal(result.reason, "SEED_ON_WALL");
});

test("L room in RECTANGLE mode: the clicked part only", () => {
  const result = detect(
    plan({ rects: L_RECTS }),
    { x: 100, y: 80 },
    { shape: "RECTANGLE" }
  );
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

// Room + corridor no wider than a door (1 m), whose far side is a row of
// doors (short wall stubs), crossed by a dash-dot axis line.
const CORRIDOR_RECTS = [
  [50, 40, 54, 204], // left
  [50, 40, 404, 44], // top, room + corridor
  [50, 200, 204, 204], // room bottom
  [200, 144, 204, 204], // step between room and corridor
  [200, 140, 240, 144], // corridor bottom: stubs between the doors
  [290, 140, 325, 144],
  [370, 140, 404, 144],
  [400, 40, 404, 144], // corridor end
  [262, 140, 266, 300], // walls of the rooms behind the doors
  [345, 140, 349, 300],
];
const AXIS = (u, v) =>
  u >= 230 && u < 232 && (v % 100 < 70 || v % 100 >= 80) && v % 100 < 90;
const CORRIDOR_AREA = (200 - 54) * (200 - 44) + (400 - 200) * (140 - 44);

for (const [name, seed] of [
  ["room", { x: 100, y: 150 }],
  ["corridor", { x: 300, y: 90 }],
]) {
  test(`L mode, room + narrow corridor clicked in the ${name}`, () => {
    const result = detect(plan({ rects: CORRIDOR_RECTS, inks: [AXIS] }), seed, {
      shape: "L",
    });
    assert.equal(result.points?.length, 6);
    assert.deepEqual(getBbox(result.points), [54, 44, 400, 200]);
    assert.equal(getArea(result.points), CORRIDOR_AREA);
  });
}

test("AUTO mode does not enter a corridor no wider than a door", () => {
  const result = detect(plan({ rects: CORRIDOR_RECTS, inks: [AXIS] }), {
    x: 100,
    y: 150,
  });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), [54, 44, 200, 200]);
});

test("coloured line across the room: a wall unless colours are ignored", () => {
  const imageData = plan({
    rects: [LEFT, RIGHT, TOP, BOTTOM],
    redRects: [[150, 0, 152, 300]],
  });
  const seed = { x: 100, y: 150 };
  assert.deepEqual(getBbox(detect(imageData, seed).points), [54, 44, 150, 200]);
  assert.deepEqual(
    getBbox(detect(imageData, seed, { ignoreColoredLines: true }).points),
    ROOM_BBOX
  );
});

test("open door leaf lying next to a wall: the side goes to the wall", () => {
  // door in the top wall (150..240), hinged at 240, leaf open along the right
  // wall, 10 cm in front of it
  const rects = [
    LEFT,
    RIGHT,
    BOTTOM,
    [50, 40, 150, 44],
    [240, 40, 254, 44],
    [238, 44, 240, 134], // leaf
  ];
  const result = detect(plan({ rects }), { x: 100, y: 100 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("door in a corner: the wall stub next to it still closes the room", () => {
  // right wall: stub 44..100 then a door down to the corner (1 m wide)
  const rects = [LEFT, TOP, BOTTOM, [250, 40, 254, 100], [380, 20, 384, 280]];
  const result = detect(plan({ rects }), { x: 100, y: 150 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("existing annotations are a mask: the room stops at their outline", () => {
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] });
  // annotation covering the left part of the room (and its walls), x < 130
  const exclusionMask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 30; y < 220; y++) {
    for (let x = 40; x < 130; x++) exclusionMask[y * WIDTH + x] = 1;
  }
  const result = detect(imageData, { x: 190, y: 120 }, { exclusionMask });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), [130, 44, 250, 200]);

  const inside = detect(imageData, { x: 100, y: 120 }, { exclusionMask });
  assert.equal(inside.points, null);
  assert.equal(inside.reason, "SEED_ON_ANNOTATION");
});

test("drawn rectangle: sides snap to the walls around, free sides stay", () => {
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] });
  // roughly the room: every side within 0.5 m of its wall
  const rough = detect(imageData, null, {
    baseRectangle: { p1: { x: 70, y: 30 }, p2: { x: 230, y: 215 } },
  });
  assert.deepEqual(getBbox(rough.points), ROOM_BBOX);

  // right side drawn in the middle of the room, far from any wall
  const partial = detect(imageData, null, {
    baseRectangle: { p1: { x: 60, y: 50 }, p2: { x: 150, y: 190 } },
    shape: "RECTANGLE",
  });
  assert.deepEqual(getBbox(partial.points), [54, 44, 150, 200]);
});

test("anti-aliased wall: the side skips the grey fringe", () => {
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] });
  // grey fringe rows / columns on the room side of the bottom and left walls
  const setGrey = (x, y) => {
    const i = (y * WIDTH + x) * 4;
    imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = 150;
  };
  for (let x = 50; x < 254; x++) setGrey(x, 199);
  for (let y = 40; y < 204; y++) setGrey(54, y);
  // the fringe is the nearest ink (x = 54, y = 199): without the refinement
  // the room would stop 1 px short of both walls
  const result = detect(imageData, { x: 150, y: 120 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});
