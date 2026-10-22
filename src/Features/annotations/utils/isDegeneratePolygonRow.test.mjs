import assert from "node:assert/strict";
import { test } from "node:test";

import isDegeneratePolygonRow from "./isDegeneratePolygonRow.js";

test("a 2-point ring (vertical band drawn in 3D) is degenerate", () => {
  assert.equal(
    isDegeneratePolygonRow({ points: [{ id: "a" }, { id: "b" }] }),
    true
  );
  assert.equal(isDegeneratePolygonRow({ points: [{ id: "a" }] }), true);
  assert.equal(isDegeneratePolygonRow({ points: [] }), true);
});

test("3+ points can be a POLYGON", () => {
  assert.equal(
    isDegeneratePolygonRow({ points: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
    false
  );
});

test("a mesh sheet keeps its POLYGON type whatever its plan projection", () => {
  assert.equal(
    isDegeneratePolygonRow({
      isMesh3d: true,
      points: [{ id: "a" }, { id: "b" }],
    }),
    false
  );
});

test("rows without a points array are not judged", () => {
  assert.equal(isDegeneratePolygonRow({}), false);
  assert.equal(isDegeneratePolygonRow({ points: null }), false);
  assert.equal(isDegeneratePolygonRow(null), false);
});
