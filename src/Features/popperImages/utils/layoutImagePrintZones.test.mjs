import assert from "node:assert/strict";
import { test } from "node:test";

import layoutImagePrintZones, {
  getPrintZoneTileLinkPoint,
} from "./layoutImagePrintZones.js";

const RECT = { width: 1200, height: 800 };

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function assertNoOverlap(tiles) {
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      assert.ok(
        !overlaps(tiles[i], tiles[j]),
        `tiles ${tiles[i].id} and ${tiles[j].id} overlap`
      );
    }
  }
}

function assertInside(tiles, rect) {
  tiles.forEach((t) => {
    assert.ok(t.x >= 0 && t.y >= 0, `tile ${t.id} starts outside`);
    assert.ok(t.x + t.width <= rect.width, `tile ${t.id} too far right`);
    assert.ok(t.y + t.height <= rect.height, `tile ${t.id} too far down`);
  });
}

test("empty or degenerate input is safe", () => {
  assert.deepEqual(layoutImagePrintZones({ items: [], rect: RECT }).tiles, []);
  assert.deepEqual(
    layoutImagePrintZones({
      items: [{ id: "a", anchor: { x: 1, y: 1 }, aspect: 1 }],
      rect: { width: 0, height: 0 },
    }).tiles,
    []
  );
  // A photo that cannot be projected still gets a tile.
  const { tiles } = layoutImagePrintZones({
    items: [{ id: "a", anchor: { x: NaN, y: 1 }, aspect: 1 }],
    rect: RECT,
  });
  assert.equal(tiles.length, 1);
  assert.ok(tiles[0].side);
});

test("each photo goes to the edge nearest to its anchor, centred in the zone", () => {
  const { tiles, tileSize, insets, zones } = layoutImagePrintZones({
    items: [
      { id: "top", anchor: { x: 300, y: 100 }, aspect: 1 },
      { id: "right", anchor: { x: 1100, y: 250 }, aspect: 1 },
      { id: "bottom", anchor: { x: 600, y: 700 }, aspect: 1 },
      { id: "left", anchor: { x: 100, y: 400 }, aspect: 1 },
    ],
    rect: RECT,
    tileSize: 160,
  });
  assert.equal(tileSize, 160);
  assert.deepEqual(
    tiles.map((t) => [t.id, t.side]),
    [
      ["top", "TOP"],
      ["right", "RIGHT"],
      ["bottom", "BOTTOM"],
      ["left", "LEFT"],
    ]
  );
  // Centred in the zone (not on the anchor), glued to the edge across it.
  const top = tiles[0];
  assert.equal(top.x + top.width / 2, 600);
  assert.equal(top.y, 12);
  const right = tiles[1];
  assert.equal(right.y + right.height / 2, 400);
  assert.equal(right.x + right.width, RECT.width - 12);
  assert.deepEqual(insets, { top: 180, right: 180, bottom: 180, left: 180 });
  assert.deepEqual(zones.TOP, {
    x: 12,
    y: 12,
    width: 1176,
    height: 160,
    count: 1,
  });
  assert.deepEqual(zones.RIGHT, {
    x: 1028,
    y: 180,
    width: 160,
    height: 440,
    count: 1,
  });
  assertInside(tiles, RECT);
});

test("the tiles do not move when the anchors move with the camera", () => {
  const layout = (dx, dy, previousSideById) =>
    layoutImagePrintZones({
      items: [
        { id: "a", anchor: { x: 1000 + dx, y: 300 + dy }, aspect: 1 },
        { id: "b", anchor: { x: 1050 + dx, y: 500 + dy }, aspect: 1.5 },
      ],
      rect: RECT,
      previousSideById,
    }).tiles;
  const first = layout(0, 0, null);
  const previous = Object.fromEntries(first.map((t) => [t.id, t.side]));
  assert.deepEqual(layout(-60, 40, previous), first);
  assert.deepEqual(layout(30, -80, previous), first);
});

test("a photo keeps its zone until another one is clearly better", () => {
  const run = (x, previousSideById) =>
    layoutImagePrintZones({
      items: [{ id: "a", anchor: { x, y: 400 }, aspect: 1 }],
      rect: RECT,
      previousSideById,
    }).tiles[0].side;
  assert.equal(run(250, null), "LEFT");
  assert.equal(run(250, { a: "TOP" }), "TOP");
  assert.equal(run(50, { a: "TOP" }), "LEFT");
});

test("a pinned photo stays in its zone whatever its anchor", () => {
  const { tiles } = layoutImagePrintZones({
    items: [
      { id: "a", anchor: { x: 1100, y: 400 }, aspect: 1 },
      { id: "b", anchor: { x: 1100, y: 420 }, aspect: 1 },
    ],
    rect: RECT,
    pinnedSideById: { a: "LEFT" },
  });
  assert.deepEqual(
    tiles.map((t) => [t.side, t.pinned]),
    [
      ["LEFT", true],
      ["RIGHT", false],
    ]
  );
});

test("a zone override sets the thickness and the ends of the zone", () => {
  const { tiles, zones } = layoutImagePrintZones({
    items: [{ id: "a", anchor: { x: 1100, y: 400 }, aspect: 1 }],
    rect: RECT,
    zones: { RIGHT: { thickness: 200, startInset: 100, endInset: 300 } },
  });
  assert.deepEqual(zones.RIGHT, {
    x: 988,
    y: 100,
    width: 200,
    height: 400,
    count: 1,
  });
  assert.deepEqual(
    { ...tiles[0] },
    {
      id: "a",
      side: "RIGHT",
      pinned: false,
      x: 988,
      y: 200,
      width: 200,
      height: 200,
    }
  );
});

test("a crowded edge hands photos over to the other zones", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    anchor: { x: 1100, y: 150 + i * 70 },
    aspect: 1,
  }));
  const { tiles } = layoutImagePrintZones({
    items,
    rect: RECT,
    tileSize: 160,
  });
  assert.equal(tiles.length, 8);
  const sides = new Set(tiles.map((t) => t.side));
  assert.ok(sides.has("RIGHT"));
  assert.ok(sides.size >= 3, "the load is spread over several zones");
  assertNoOverlap(tiles);
  assertInside(tiles, RECT);
});

test("tiles follow the order of their anchors along a zone (no crossing)", () => {
  const { tiles } = layoutImagePrintZones({
    items: [
      { id: "c", anchor: { x: 620, y: 20 }, aspect: 1 },
      { id: "a", anchor: { x: 580, y: 20 }, aspect: 1 },
      { id: "b", anchor: { x: 600, y: 20 }, aspect: 1 },
    ],
    rect: RECT,
    tileSize: 160,
  });
  assert.ok(tiles.every((t) => t.side === "TOP"));
  const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
  assert.ok(byId.a.x < byId.b.x && byId.b.x < byId.c.x);
  assertNoOverlap(tiles);
});

test("auto size shrinks the tiles of a crowded zone until they fit", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    id: `p${i}`,
    anchor: { x: 100 + ((i * 137) % 1000), y: 100 + ((i * 59) % 600) },
    aspect: 4 / 3,
  }));
  const auto = layoutImagePrintZones({
    items,
    rect: RECT,
    tileSize: 160,
    minTileSize: 48,
  });
  assert.ok(auto.tileSize < 160 && auto.tileSize >= 48);
  assert.equal(auto.tiles.length, 40);
  assertNoOverlap(auto.tiles);
  assertInside(auto.tiles, RECT);

  // Fixed size: never shrunk, the tiles overlap instead.
  const fixed = layoutImagePrintZones({
    items,
    rect: RECT,
    tileSize: 160,
    autoShrink: false,
  });
  assert.equal(fixed.tileSize, 160);
  assert.equal(fixed.tiles.length, 40);
  assert.ok(fixed.tiles.every((t) => Math.min(t.width, t.height) >= 120));
  assertInside(fixed.tiles, RECT);
});

test("reserved rects are kept free of tiles", () => {
  const reserved = [{ x: 900, y: 0, width: 300, height: 260 }];
  const items = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    anchor: { x: 1000 + i * 20, y: 60 + i * 30 },
    aspect: 1,
  }));
  const { tiles } = layoutImagePrintZones({
    items,
    rect: RECT,
    tileSize: 140,
    reserved,
  });
  assert.equal(tiles.length, 6);
  tiles.forEach((t) =>
    assert.ok(!overlaps(t, reserved[0]), `tile ${t.id} is in the reserve`)
  );
  assertNoOverlap(tiles);
});

test("the layout is deterministic", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    anchor: { x: 200 + ((i * 311) % 800), y: 150 + ((i * 97) % 500) },
    aspect: i % 2 ? 0.8 : 1.5,
  }));
  const a = layoutImagePrintZones({ items, rect: RECT });
  const b = layoutImagePrintZones({ items, rect: RECT });
  assert.deepEqual(a, b);
});

test("the leader leaves the tile by its inner edge, towards the anchor", () => {
  const top = { side: "TOP", x: 100, y: 12, width: 160, height: 120 };
  assert.deepEqual(getPrintZoneTileLinkPoint(top, { x: 150, y: 400 }), {
    x: 150,
    y: 132,
  });
  assert.deepEqual(getPrintZoneTileLinkPoint(top, { x: 900, y: 400 }), {
    x: 248,
    y: 132,
  });
  const right = { side: "RIGHT", x: 1000, y: 300, width: 160, height: 120 };
  assert.deepEqual(getPrintZoneTileLinkPoint(right, { x: 500, y: 0 }), {
    x: 1000,
    y: 312,
  });
});
