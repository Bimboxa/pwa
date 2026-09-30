import { test } from "node:test";
import assert from "node:assert/strict";

import groupPdfPassagesByPage from "./groupPdfPassagesByPage.js";

const rel = (id, pageNumber, y, x = 0) => ({
  id,
  pageNumber,
  rects: [{ x, y, width: 0.2, height: 0.02 }],
});

test("empty / missing input", () => {
  assert.deepEqual(groupPdfPassagesByPage(undefined), []);
  assert.deepEqual(groupPdfPassagesByPage([]), []);
});

test("groups by page in reading order", () => {
  const groups = groupPdfPassagesByPage([
    rel("c", 24, 0.1),
    rel("b", 23, 0.8),
    rel("a", 23, 0.2),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.pageNumber, g.rels.map((r) => r.id)]),
    [
      [23, ["a", "b"]],
      [24, ["c"]],
    ]
  );
});

test("same line: left to right", () => {
  const groups = groupPdfPassagesByPage([
    rel("right", 1, 0.5, 0.6),
    rel("left", 1, 0.5, 0.1),
  ]);
  assert.deepEqual(
    groups[0].rels.map((r) => r.id),
    ["left", "right"]
  );
});

test("whole-resource links are not passages", () => {
  const groups = groupPdfPassagesByPage([
    { id: "whole", pageNumber: null, rects: [] },
    { id: "noRects", pageNumber: 2 },
    rel("a", 2, 0.3),
  ]);
  assert.deepEqual(
    groups.map((g) => g.rels.map((r) => r.id)),
    [["a"]]
  );
});

test("does not mutate the input order", () => {
  const input = [rel("b", 2, 0.1), rel("a", 1, 0.1)];
  groupPdfPassagesByPage(input);
  assert.deepEqual(
    input.map((r) => r.id),
    ["b", "a"]
  );
});
