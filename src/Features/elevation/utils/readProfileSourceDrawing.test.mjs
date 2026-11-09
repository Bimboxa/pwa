import assert from "node:assert/strict";
import { test } from "node:test";

import readProfileSourceDrawing from "./readProfileSourceDrawing.js";

const baseMap = {
  image: { imageSize: { width: 100, height: 200 } },
  meterByPx: 0.01,
};

// 4 vertices, the first segment is a hidden spacer holding the base point.
const refs = [
  { id: "a", isBasePoint: true },
  { id: "b" },
  { id: "c", type: "circle" },
  { id: "d" },
];
const rows = [
  { x: 0.1, y: 0.5 },
  { x: 0.2, y: 0.5 },
  { x: 0.3, y: 0.4 },
  { x: 0.4, y: 0.5 },
];

test("pixel frame, base point origin, arc types kept", () => {
  const d = readProfileSourceDrawing({
    src: { points: refs },
    srcRows: rows,
    srcBaseMap: baseMap,
  });
  assert.equal(d.pts.length, 4);
  assert.deepEqual([d.pts[0].x, d.pts[0].y], [10, 100]);
  assert.equal(d.pts[2].type, "circle");
  assert.equal(d.refPt, d.pts[0]);
  assert.deepEqual([d.xRef, d.yRef], [10, 100]);
  assert.equal(d.visiblePts.length, 4);
  assert.equal(d.closed, false);
  assert.equal(d.meterByPx, 0.01);
});

test("hidden spacer segment: longest visible run, base point still the origin", () => {
  const d = readProfileSourceDrawing({
    src: { points: refs, hiddenSegmentsIdx: [0] },
    srcRows: rows,
    srcBaseMap: baseMap,
  });
  assert.equal(d.visiblePts.length, 3);
  assert.equal(d.visiblePts[0], d.pts[1]);
  assert.equal(d.refPt, d.pts[0]);
});

test("closed loop lost when a segment is hidden", () => {
  const open = readProfileSourceDrawing({
    src: { points: refs, closeLine: true, hiddenSegmentsIdx: [1] },
    srcRows: rows,
    srcBaseMap: baseMap,
  });
  assert.equal(open.closed, false);
  const closed = readProfileSourceDrawing({
    src: { points: refs, closeLine: true },
    srcRows: rows,
    srcBaseMap: baseMap,
  });
  assert.equal(closed.closed, true);
});

test("no base point: first x / lowest y; degenerate inputs → null", () => {
  const d = readProfileSourceDrawing({
    src: { points: refs.map(({ isBasePoint, ...r }) => r) },
    srcRows: rows,
    srcBaseMap: baseMap,
  });
  assert.equal(d.refPt, null);
  assert.deepEqual([d.xRef, d.yRef], [10, 100]);
  assert.equal(
    readProfileSourceDrawing({
      src: { points: refs },
      srcRows: rows,
      srcBaseMap: {},
    }),
    null
  );
  assert.equal(
    readProfileSourceDrawing({
      src: { points: refs.slice(0, 1) },
      srcRows: rows,
      srcBaseMap: baseMap,
    }),
    null
  );
  assert.equal(
    readProfileSourceDrawing({
      src: { points: refs, hiddenSegmentsIdx: [0, 1, 2] },
      srcRows: rows,
      srcBaseMap: baseMap,
    }),
    null
  );
});
