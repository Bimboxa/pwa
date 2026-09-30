import { test } from "node:test";
import assert from "node:assert/strict";

import getPdfPageFitScale from "./getPdfPageFitScale.js";

const A4 = { pageWidth: 595, pageHeight: 842 };

test("width mode fills the container width", () => {
  const scale = getPdfPageFitScale({ ...A4, containerWidth: 611, padding: 8 });
  assert.equal(scale, 1);
});

test("width mode ignores the container height", () => {
  const scale = getPdfPageFitScale({
    ...A4,
    containerWidth: 1206,
    containerHeight: 100,
    padding: 8,
  });
  assert.equal(scale, 2);
});

test("page mode shows the whole page in a wide container", () => {
  const scale = getPdfPageFitScale({
    ...A4,
    fitMode: "page",
    containerWidth: 1600,
    containerHeight: 858,
    padding: 8,
  });
  assert.equal(scale, 1);
});

test("page mode is bounded by the width in a narrow container", () => {
  const scale = getPdfPageFitScale({
    ...A4,
    fitMode: "page",
    containerWidth: 313.5,
    containerHeight: 2000,
    padding: 8,
  });
  assert.equal(scale, 0.5);
});

test("zoom multiplies the fit", () => {
  const scale = getPdfPageFitScale({
    ...A4,
    fitMode: "page",
    zoom: 2,
    containerWidth: 1600,
    containerHeight: 858,
    padding: 8,
  });
  assert.equal(scale, 2);
});

test("never returns a scale under the minimum", () => {
  assert.equal(getPdfPageFitScale({ ...A4, containerWidth: 0 }), 0.1);
  assert.equal(
    getPdfPageFitScale({ ...A4, containerWidth: 20, padding: 8 }),
    0.1
  );
});
