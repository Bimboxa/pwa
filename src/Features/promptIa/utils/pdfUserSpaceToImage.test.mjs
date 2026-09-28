import assert from "node:assert/strict";
import { test } from "node:test";
import {
  userToImage,
  convertPayloadToImageSpace,
} from "./pdfUserSpaceToImage.js";

// A4 landscape page whose CropBox starts at (10, 20): view = [10, 20, 852, 615]
const page = { view: [10, 20, 852, 615] }; // 842 × 595
const full = { x1: 0, y1: 0, x2: 1, y2: 1 };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("rotation 0: top-left of the view maps to (0,0), bottom-right to (1,1)", () => {
  const tl = userToImage({ x: 10, y: 615 }, { rotation: 0, bboxInRatio: full }, page);
  const br = userToImage({ x: 852, y: 20 }, { rotation: 0, bboxInRatio: full }, page);
  assert.ok(close(tl.x, 0) && close(tl.y, 0));
  assert.ok(close(br.x, 1) && close(br.y, 1));
});

test("rotation 90 (clockwise): the unrotated top-left corner lands top-right", () => {
  const p = userToImage({ x: 10, y: 615 }, { rotation: 90, bboxInRatio: full }, page);
  assert.ok(close(p.x, 1) && close(p.y, 0));
  // unrotated bottom-left → top-left
  const q = userToImage({ x: 10, y: 20 }, { rotation: 90, bboxInRatio: full }, page);
  assert.ok(close(q.x, 0) && close(q.y, 0));
});

test("rotation 180 and 270 are consistent with the pdf.js viewport", () => {
  const p = userToImage({ x: 10, y: 615 }, { rotation: 180, bboxInRatio: full }, page);
  assert.ok(close(p.x, 1) && close(p.y, 1));
  const q = userToImage({ x: 10, y: 615 }, { rotation: 270, bboxInRatio: full }, page);
  assert.ok(close(q.x, 0) && close(q.y, 1));
});

test("a crop rescales the normalized coordinates to the crop box", () => {
  const frame = { rotation: 0, bboxInRatio: { x1: 0.25, y1: 0.5, x2: 0.75, y2: 1 } };
  // centre of the page: (0.5, 0.5) on R2 → x = (0.5-0.25)/0.5 = 0.5, y = 0
  const c = userToImage({ x: 10 + 421, y: 615 - 297.5 }, frame, page);
  assert.ok(close(c.x, 0.5) && close(c.y, 0));
  // top-left of the page is outside the crop
  const o = userToImage({ x: 10, y: 615 }, frame, page);
  assert.ok(o.x < 0 && o.y < 0);
});

test("convertPayloadToImageSpace converts every point group and drops out-of-crop annotations", () => {
  const frame = { rotation: 0, bboxInRatio: { x1: 0, y1: 0, x2: 0.5, y2: 1 } };
  const payload = {
    annotations: [
      {
        id: "in",
        type: "POLYGON",
        points: [
          { x: 10, y: 615 },
          { x: 431, y: 615 },
          { x: 431, y: 20 },
        ],
        cuts: [{ points: [{ x: 100, y: 500 }, { x: 200, y: 500 }, { x: 200, y: 400 }] }],
      },
      { id: "out", type: "POLYLINE", points: [{ x: 600, y: 300 }, { x: 800, y: 300 }] },
      {
        id: "text",
        type: "FREE_TEXT",
        textContent: "A",
        labelPoint: { x: 431.5, y: 300 }, // 0.5 pt past the crop edge: within tolerance
      },
    ],
  };
  const { data, dropped } = convertPayloadToImageSpace(payload, frame, page);
  assert.deepEqual(dropped, ["out"]);
  assert.equal(data.annotations.length, 2);
  const poly = data.annotations[0];
  assert.ok(close(poly.points[1].x, 1) && close(poly.points[1].y, 0));
  assert.ok(close(poly.points[2].y, 1));
  assert.equal(poly.cuts[0].points.length, 3);
  assert.equal(data.annotations[1].labelPoint.x, 1);
});
