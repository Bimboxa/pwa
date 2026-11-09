import assert from "node:assert/strict";
import { test } from "node:test";

import layoutCaptureImageTiles from "./layoutCaptureImageTiles.js";

test("2 columns: tiles fill rows left to right, rows as tall as their tallest tile", () => {
  const { tiles, height, tileWidth } = layoutCaptureImageTiles({
    items: [
      { id: "a", aspect: 2, captionHeight: 0 }, // 100 × 50
      { id: "b", aspect: 1, captionHeight: 18 }, // 100 × 118
      { id: "c", aspect: 4 / 3, captionHeight: 0 }, // 100 × 75
    ],
    zone: { width: 208, columns: 2, gap: 8 },
  });
  assert.equal(tileWidth, 100);
  assert.deepEqual(
    tiles.map((t) => [t.id, t.number, t.x, t.y]),
    [
      ["a", 1, 0, 0],
      ["b", 2, 108, 0],
      ["c", 3, 0, 126],
    ]
  );
  assert.equal(tiles[1].height, 118);
  assert.equal(height, 126 + 75);
});

test("empty input and bad aspect ratios are safe", () => {
  assert.deepEqual(
    layoutCaptureImageTiles({ items: [], zone: { width: 100, gap: 0 } }),
    {
      tiles: [],
      height: 0,
      tileWidth: 50,
    }
  );
  const { tiles } = layoutCaptureImageTiles({
    items: [{ id: "x", aspect: 0 }],
    zone: { width: 120, columns: 1, gap: 0 },
  });
  assert.equal(tiles[0].imageHeight, 90); // falls back to 4/3
});
