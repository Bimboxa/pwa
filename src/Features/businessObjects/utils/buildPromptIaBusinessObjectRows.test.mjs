import test from "node:test";
import assert from "node:assert/strict";

import parsePromptIaBusinessObjects from "./parsePromptIaBusinessObjects.js";
import buildPromptIaBusinessObjectRows from "./buildPromptIaBusinessObjectRows.js";

const listing = { id: "listing1", projectId: "project1", scopeId: "scope1" };

function build(businessObjects) {
  const { items } = parsePromptIaBusinessObjects({ businessObjects });
  let n = 0;
  return buildPromptIaBusinessObjectRows({
    listing,
    items,
    newId: () => `id${++n}`,
  });
}

test("fresh ids, remapped parents, listing keys", () => {
  const rows = build([
    { id: "o1", label: "Chapitre", isTitle: true, unit: "S" },
    { id: "o2", parentId: "o1", label: "Article", unit: "L" },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.parentId]),
    [
      ["id1", null],
      ["id2", "id1"],
    ]
  );
  for (const row of rows) {
    assert.equal(row.listingId, "listing1");
    assert.equal(row.projectId, "project1");
    assert.equal(row.scopeId, "scope1");
    assert.equal(typeof row.color, "string");
  }
  // a title carries no unit
  assert.equal(rows[0].isTitle, true);
  assert.equal(rows[0].unit, null);
  assert.equal(rows[1].unit, "ml");
  assert.equal("isTitle" in rows[1], false);
});

test("optional source fields are only set when present", () => {
  const rows = build([
    {
      id: "a",
      label: "A",
      code: "1.2.",
      refUnit: "ML",
      refQty: 0,
      description: "d",
    },
    { id: "b", label: "B" },
  ]);
  assert.equal(rows[0].code, "1.2.");
  assert.equal(rows[0].refQty, 0);
  assert.equal(rows[0].description, "d");
  assert.equal(rows[0].unit, "ML");
  assert.equal("refUnit" in rows[0], false);
  for (const key of ["code", "refQty", "description"])
    assert.equal(key in rows[1], false);
});

test("siblings keep the document order per parent", () => {
  const rows = build([
    { id: "a", label: "A" },
    { id: "a1", parentId: "a", label: "A1" },
    { id: "a2", parentId: "a", label: "A2" },
    { id: "a3", parentId: "a", label: "A3" },
    { id: "b", label: "B" },
  ]);
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
  assert.ok(byLabel.A.sortIndex < byLabel.B.sortIndex);
  assert.ok(byLabel.A1.sortIndex < byLabel.A2.sortIndex);
  assert.ok(byLabel.A2.sortIndex < byLabel.A3.sortIndex);
  assert.ok(rows.every((r) => typeof r.sortIndex === "string"));
});

test("large sibling groups stay ordered under localeCompare", () => {
  const rows = build(
    Array.from({ length: 120 }, (_, i) => ({ id: `o${i}`, label: `L${i}` }))
  );
  const sorted = [...rows].sort((a, b) =>
    a.sortIndex.localeCompare(b.sortIndex)
  );
  assert.deepEqual(
    sorted.map((r) => r.label),
    rows.map((r) => r.label)
  );
});
