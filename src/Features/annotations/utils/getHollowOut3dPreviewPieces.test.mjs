import assert from "node:assert/strict";
import { test } from "node:test";

import getHollowOut3dPreviewPieces from "./getHollowOut3dPreviewPieces.js";

const rect = (x0, y0, x1, y1) => [
  [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
  ],
];

const host = rect(0, 0, 10, 10);

test("a footprint inside the host leaves one piece with one hole", () => {
  const preview = getHollowOut3dPreviewPieces({
    hostFootprint: host,
    cutterFootprints: [rect(4, 4, 6, 6)],
  });
  assert.equal(preview.pieces.length, 1);
  assert.equal(preview.pieces[0].points.length, 4);
  assert.equal(preview.pieces[0].cuts.length, 1);
  assert.equal(preview.consumed, false);
  assert.equal(preview.outline.length, 1);
});

test("a footprint crossing the host splits it in two pieces", () => {
  const preview = getHollowOut3dPreviewPieces({
    hostFootprint: host,
    cutterFootprints: [rect(4, -1, 6, 11), null],
  });
  assert.equal(preview.pieces.length, 2);
});

test("a footprint covering the host consumes it", () => {
  const preview = getHollowOut3dPreviewPieces({
    hostFootprint: host,
    cutterFootprints: [rect(-1, -1, 11, 11)],
  });
  assert.equal(preview.pieces.length, 0);
  assert.equal(preview.consumed, true);
});

test("no cutter keeps the host, no host footprint gives no preview", () => {
  const preview = getHollowOut3dPreviewPieces({
    hostFootprint: host,
    cutterFootprints: [],
  });
  assert.equal(preview.pieces.length, 1);
  assert.equal(preview.pieces[0].cuts.length, 0);
  assert.equal(
    getHollowOut3dPreviewPieces({ hostFootprint: null, cutterFootprints: [] }),
    null
  );
});
