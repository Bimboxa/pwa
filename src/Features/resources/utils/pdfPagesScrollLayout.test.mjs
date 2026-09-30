import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getPdfPagesScrollLayout,
  getPdfPageIndexAtY,
  getPdfPagesVisibleRange,
  getPdfMostVisiblePageIndex,
  getPdfScrollAnchor,
  getPdfScrollForAnchor,
} from "./pdfPagesScrollLayout.js";

// 4 pages of 100 x 200 at scale 1, gap 10, padding 8
const sizes = Array.from({ length: 4 }, () => ({ width: 100, height: 200 }));
const layout = getPdfPagesScrollLayout({
  sizes,
  scale: 1,
  gap: 10,
  padding: 8,
});

test("layout stacks the pages", () => {
  assert.deepEqual(layout.offsets, [8, 218, 428, 638]);
  assert.deepEqual(layout.heights, [200, 200, 200, 200]);
  assert.equal(layout.totalHeight, 846);
  assert.equal(layout.contentWidth, 116);
});

test("layout scales sizes, not gaps", () => {
  const scaled = getPdfPagesScrollLayout({
    sizes,
    scale: 2,
    gap: 10,
    padding: 8,
  });
  assert.deepEqual(scaled.offsets, [8, 418, 828, 1238]);
  assert.equal(scaled.contentWidth, 216);
});

test("empty document", () => {
  const empty = getPdfPagesScrollLayout({ sizes: [], scale: 1 });
  assert.equal(empty.totalHeight, 0);
  assert.equal(getPdfPageIndexAtY(empty, 10), -1);
  assert.deepEqual(
    getPdfPagesVisibleRange(empty, { scrollTop: 0, viewportHeight: 100 }),
    { first: 0, last: -1 }
  );
});

test("page index at y, gaps go to the closest page", () => {
  assert.equal(getPdfPageIndexAtY(layout, 0), 0);
  assert.equal(getPdfPageIndexAtY(layout, 100), 0);
  assert.equal(getPdfPageIndexAtY(layout, 210), 0); // gap, closer to page 0
  assert.equal(getPdfPageIndexAtY(layout, 216), 1); // gap, closer to page 1
  assert.equal(getPdfPageIndexAtY(layout, 300), 1);
  assert.equal(getPdfPageIndexAtY(layout, 5000), 3);
});

test("visible range with and without overscan", () => {
  assert.deepEqual(
    getPdfPagesVisibleRange(layout, { scrollTop: 0, viewportHeight: 200 }),
    { first: 0, last: 0 }
  );
  assert.deepEqual(
    getPdfPagesVisibleRange(layout, { scrollTop: 100, viewportHeight: 200 }),
    { first: 0, last: 1 }
  );
  assert.deepEqual(
    getPdfPagesVisibleRange(layout, {
      scrollTop: 220,
      viewportHeight: 200,
      overscan: 200,
    }),
    { first: 0, last: 2 }
  );
});

test("most visible page follows the scroll", () => {
  const at = (scrollTop, currentIndex) =>
    getPdfMostVisiblePageIndex(layout, {
      scrollTop,
      viewportHeight: 200,
      currentIndex,
    });
  assert.equal(at(0, 0), 0);
  assert.equal(at(90, 0), 0); // page 0: 118 px, page 1: 72 px
  assert.equal(at(150, 0), 1); // page 0: 58 px, page 1: 132 px
});

test("current page keeps the title on a tie", () => {
  // viewport tall enough for two whole pages
  const at = (currentIndex) =>
    getPdfMostVisiblePageIndex(layout, {
      scrollTop: 426,
      viewportHeight: 420,
      currentIndex,
    });
  assert.equal(at(3), 3);
  assert.equal(at(2), 2);
  assert.equal(at(0), 2); // not visible any more: the first best one
});

test("anchor survives a zoom", () => {
  const view = { viewportWidth: 300 };
  const anchor = getPdfScrollAnchor(layout, {
    scrollTop: 250,
    scrollLeft: 0,
    viewportX: 150,
    viewportY: 100,
    ...view,
  });
  assert.equal(anchor.index, 1);
  assert.ok(Math.abs(anchor.fractionY - (350 - 218) / 200) < 1e-9);
  assert.equal(anchor.unitsX, 0); // on the pages' axis

  // same layout: same scroll position
  const same = getPdfScrollForAnchor(layout, anchor, view);
  assert.ok(Math.abs(same.scrollTop - 250) < 1e-9);
  assert.ok(Math.abs(same.scrollLeft - 0) < 1e-9);

  // zoom x4: pages 400 px wide, wider than the viewport
  const zoomed = getPdfPagesScrollLayout({
    sizes,
    scale: 4,
    gap: 10,
    padding: 8,
  });
  const next = getPdfScrollForAnchor(zoomed, anchor, view);
  // the anchored point is still 100 px under the viewport top
  const y = next.scrollTop + 100;
  assert.ok(
    Math.abs((y - zoomed.offsets[1]) / zoomed.heights[1] - anchor.fractionY) <
      1e-9
  );
  // and still on the pages' axis, 150 px from the viewport left
  assert.ok(Math.abs(next.scrollLeft + 150 - zoomed.contentWidth / 2) < 1e-9);
});
