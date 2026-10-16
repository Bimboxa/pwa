import { test } from "node:test";
import assert from "node:assert/strict";

import dedupeAdjacentVertices from "./dedupeAdjacentVertices.js";

const v = (x, y, offsetBottom = 0) => ({ x, y, offsetBottom });

test("a vertical segment (same plan position, other altitude) is kept", () => {
  const stairs = [v(0.1, 0.5, 0), v(0.1, 0.5, 2), v(0.3, 0.5, 2), v(0.3, 0.5, 3)];
  assert.deepEqual(dedupeAdjacentVertices(stairs), stairs);
});

test("a true duplicate (same plan position and altitude) is merged", () => {
  const out = dedupeAdjacentVertices([
    v(0.1, 0.5, 1),
    v(0.1, 0.5, 1.001),
    v(0.3, 0.5, 1),
  ]);
  assert.equal(out.length, 2);
});

test("closing duplicate is collapsed only at the same altitude", () => {
  const sameLevel = [v(0.1, 0.1), v(0.3, 0.1), v(0.3, 0.3), v(0.1, 0.1)];
  assert.equal(
    dedupeAdjacentVertices(sameLevel, { collapseClosingDuplicate: true }).length,
    3
  );
  const riserBack = [v(0.1, 0.1, 0), v(0.3, 0.1, 0), v(0.1, 0.1, 2)];
  assert.equal(
    dedupeAdjacentVertices(riserBack, { collapseClosingDuplicate: true }).length,
    3
  );
});
