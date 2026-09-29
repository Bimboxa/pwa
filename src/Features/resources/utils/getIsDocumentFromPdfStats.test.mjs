import test from "node:test";
import assert from "node:assert/strict";

import getIsDocumentFromPdfStats from "./getIsDocumentFromPdfStats.js";

const a4 = { widthPt: 595, heightPt: 842 };
const a0 = { widthPt: 3370, heightPt: 2384 };

test("no sampled page is not a document", () => {
  assert.equal(getIsDocumentFromPdfStats({ pages: [] }), false);
  assert.equal(getIsDocumentFromPdfStats(), false);
});

test("A4 pages full of text are a document", () => {
  const pages = [
    { ...a4, charCount: 300 }, // cover page
    { ...a4, charCount: 2500 },
    { ...a4, charCount: 3000 },
  ];
  assert.equal(getIsDocumentFromPdfStats({ pages }), true);
});

test("a large sheet is a plan, whatever its text", () => {
  const pages = [{ ...a0, charCount: 8000 }];
  assert.equal(getIsDocumentFromPdfStats({ pages }), false);
});

test("an A4 page with little text (scan, detail) is not a document", () => {
  const pages = [{ ...a4, charCount: 120 }];
  assert.equal(getIsDocumentFromPdfStats({ pages }), false);
});
