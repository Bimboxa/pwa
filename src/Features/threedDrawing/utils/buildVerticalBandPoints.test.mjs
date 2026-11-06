import { test } from "node:test";
import assert from "node:assert/strict";

import buildVerticalBandPoints from "./buildVerticalBandPoints.js";

const TOL_M = 5e-5; // the 0.1 mm rounding step

// Bottom / top of each post, as the wall builder reads them back:
// bottom = offsetZ + offsetBottom, top = offsetZ + height + offsetTop.
const readPosts = (band) =>
  band.points.map((p) => ({
    y: p.y,
    bottom: band.offsetZ + p.offsetBottom,
    top: band.offsetZ + band.height + p.offsetTop,
  }));

test("a 15 x 21 mm groove end cap lands back on the clicked vertices", () => {
  // The four vertices of a swept profile groove (plan y in px over a 1754 px
  // image, offset in m along the base map normal), clicked in cycle order.
  const x = 429.862 / 2480;
  const y0 = 787.914 / 1754;
  const y1 = 788.792 / 1754;
  const clicked = [
    { x, y: y0, offset: -0.051361203519709596 },
    { x, y: y1, offset: -0.051361203519709596 },
    { x, y: y1, offset: -0.03606835967247498 },
    { x, y: y0, offset: -0.02999999999999972 },
  ];

  const band = buildVerticalBandPoints(clicked);
  assert.equal(band.points.length, 2);

  const posts = readPosts(band).sort((a, b) => a.y - b.y);
  assert.ok(Math.abs(posts[0].bottom - -0.051361) < TOL_M);
  assert.ok(Math.abs(posts[0].top - -0.03) < TOL_M);
  assert.ok(Math.abs(posts[1].bottom - -0.051361) < TOL_M);
  assert.ok(Math.abs(posts[1].top - -0.036068) < TOL_M);
});

test("a tall wall keeps millimetre heights", () => {
  const band = buildVerticalBandPoints([
    { x: 0.1, y: 0.5, offset: 12.3456 },
    { x: 0.4, y: 0.5, offset: 12.3456 },
    { x: 0.4, y: 0.5, offset: 15.0044 },
    { x: 0.1, y: 0.5, offset: 14.5012 },
  ]);
  const posts = readPosts(band).sort((a, b) => a.top - b.top);
  assert.ok(Math.abs(posts[0].bottom - 12.3456) < TOL_M);
  assert.ok(Math.abs(posts[0].top - 14.5012) < TOL_M);
  assert.ok(Math.abs(posts[1].top - 15.0044) < TOL_M);
});
