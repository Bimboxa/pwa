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

test("drawn rectangle: goes through the click, the other sides snap", () => {
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] });
  // click (p1) inside the room, cursor (p2) roughly on the opposite corner
  const rough = detect(imageData, null, {
    baseRectangle: { p1: { x: 230, y: 180 }, p2: { x: 70, y: 30 } },
  });
  assert.deepEqual(getBbox(rough.points), [54, 44, 230, 180]);

  // cursor in the middle of the room, far from any wall: sides stay
  const free = detect(imageData, null, {
    baseRectangle: { p1: { x: 60, y: 50 }, p2: { x: 150, y: 120 } },
  });
  assert.deepEqual(getBbox(free.points), [60, 50, 150, 120]);
});

test("drawn rectangle around a room with a closed corner: L shape", () => {
  // another room in the top-right corner: x 180..250, y 44..110, with a door
  // in its left wall
  const rects = [
    LEFT,
    RIGHT,
    TOP,
    BOTTOM,
    [176, 40, 180, 80], // corner room, left wall (door 80..110)
    [176, 106, 254, 110], // corner room, bottom wall
  ];
  const imageData = plan({ rects });
  const baseRectangle = { p1: { x: 250, y: 200 }, p2: { x: 60, y: 50 } };

  const carved = detect(imageData, null, { baseRectangle });
  assert.equal(carved.points?.length, 6);
  assert.deepEqual(getBbox(carved.points), ROOM_BBOX);
  assert.equal(getArea(carved.points), 196 * 156 - (250 - 176) * (110 - 44));

  const plain = detect(imageData, null, { baseRectangle, shape: "RECTANGLE" });
  assert.equal(plain.points?.length, 4);
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

test("computation window: same room inside it, no room when it is too small", () => {
  const imageData = plan({ rects: [LEFT, RIGHT, TOP, BOTTOM] });
  const seed = { x: 150, y: 120 };
  const windowed = (size, angleDeg = 0) =>
    detect(imageData, seed, {
      angleDeg,
      frameWindow: { center: seed, width: size, height: size },
    });
  assert.deepEqual(getBbox(windowed(260).points), ROOM_BBOX);
  // the walls are out of a 1 m window: nothing closes
  assert.equal(windowed(100).points, null);
});

// Dashed swing arc of a door: quarter circle of `radius` centred on the hinge,
// in the quadrant given by the signs (sx, sy).
const swingArc = (hx, hy, radius, sx, sy) => (u, v) => {
  const dx = (u - hx) * sx;
  const dy = (v - hy) * sy;
  if (dx < 0 || dy < 0) return false;
  const r = Math.hypot(dx, dy);
  if (r < radius - 1 || r >= radius + 1) return false;
  return Math.floor(Math.atan2(dy, dx) * 12) % 2 === 0;
};

test("door flush with a corner: closed by its swing arc, even in L mode", () => {
  // right wall: 44..120, then a 0.8 m door down to the corner; behind it,
  // another closed space
  const rects = [
    LEFT,
    TOP,
    BOTTOM,
    [250, 40, 254, 120],
    [250, 40, 384, 44],
    [250, 200, 384, 204],
    [380, 40, 384, 204],
  ];
  // hinge on the upper jamb, leaf opening into the room
  const inks = [swingArc(252, 120, 80, -1, 1)];
  const seed = { x: 100, y: 100 };

  const leaking = detect(plan({ rects, inks }), seed, {
    shape: "L",
    detectDoors: false,
  });
  // through the door, into the space behind
  assert.deepEqual(getBbox(leaking.points), [54, 44, 380, 200]);

  const closed = detect(plan({ rects, inks }), seed, { shape: "L" });
  assert.equal(closed.points?.length, 4);
  assert.deepEqual(getBbox(closed.points), ROOM_BBOX);
});

test("door with its open leaf: the leaf is not a wall", () => {
  // door in the top wall (100..180), hinged at 180, leaf open into the room
  // 0.7 m in front of the right wall: too far for the leaf-against-wall rule
  const rects = [
    LEFT,
    RIGHT,
    BOTTOM,
    [50, 40, 100, 44],
    [180, 40, 254, 44],
    [178, 44, 180, 124], // leaf
  ];
  const inks = [swingArc(180, 44, 80, -1, 1)];
  const result = detect(plan({ rects, inks }), { x: 120, y: 150 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("gap without swing arc: still an opening", () => {
  const rects = [
    LEFT,
    TOP,
    BOTTOM,
    [250, 40, 254, 120],
    [250, 40, 384, 44],
    [250, 200, 384, 204],
    [380, 40, 384, 204],
  ];
  const result = detect(plan({ rects }), { x: 100, y: 100 }, { shape: "L" });
  assert.deepEqual(getBbox(result.points), [54, 44, 380, 200]);
});

test("wall line cut by the walls it meets: not a dashed line", () => {
  // the inner top line of the room runs on in the neighbouring rooms, cut by
  // each partition: 4 segments with 10 cm gaps on the same row
  const rects = [
    LEFT,
    RIGHT,
    BOTTOM,
    [10, 28, 420, 30], // outer face of the top wall
    [54, 42, 250, 44], // inner face, this room
    [38, 20, 40, 204], // neighbours: partition faces and inner top lines
    [10, 42, 38, 44],
    [264, 20, 266, 204],
    [266, 42, 400, 44],
    [410, 20, 412, 204],
    [412, 42, 420, 44],
  ];
  const result = detect(plan({ rects }), { x: 150, y: 120 });
  assert.equal(result.points?.length, 4);
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});

test("drawn rectangle: a fixture inside the room does not catch the sides", () => {
  // fixture standing in the top-right corner: its front edge (y = 90, 1.3 m
  // long, attached to the right wall) reads as a wall line 0.45 m under the
  // top wall
  const rects = [
    LEFT,
    RIGHT,
    TOP,
    BOTTOM,
    [120, 88, 250, 90],
    [120, 44, 122, 90],
  ];
  // click on the bottom-left corner, cursor next to the top-right one
  const result = detect(plan({ rects }), null, {
    baseRectangle: { p1: { x: 54, y: 200 }, p2: { x: 245, y: 50 } },
    shape: "RECTANGLE",
  });
  assert.deepEqual(getBbox(result.points), ROOM_BBOX);
});
