import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQuickEditDiff,
  parseBusinessObjectsText,
  serializeBusinessObjectsTree,
} from "./businessObjectsQuickEdit.js";

const listing = { id: "listing1", projectId: "project1", scopeId: "scope1" };

const OBJECTS = [
  { id: "a", label: "Gros œuvre", isTitle: true, unit: null, sortIndex: "a0" },
  { id: "b", parentId: "a", label: "Voiles", unit: "S", sortIndex: "a0" },
  { id: "c", parentId: "a", label: "Joints", unit: "ml", sortIndex: "a1" },
  { id: "d", parentId: "a", label: "Pompe", unit: "ens", sortIndex: "a2" },
  { id: "e", label: "Étude (type A)", unit: null, sortIndex: "a1" },
  { id: "f", label: "Surface", unit: "m² SHON", sortIndex: "a2" },
];

test("serializes free-text units, legacy keys as labels", () => {
  assert.equal(
    serializeBusinessObjectsTree(OBJECTS),
    [
      "Gros œuvre []",
      "\tVoiles (m²)",
      "\tJoints (ml)",
      "\tPompe (ens)",
      "Étude (type A)",
      "Surface (m² SHON)",
    ].join("\n")
  );
});

test("parses free-text units", () => {
  const items = parseBusinessObjectsText(
    ["A (kg)", "B (m2)", "C (m)", "D [Ft]", "E (type A)", "F ()", "G"].join(
      "\n"
    )
  );
  assert.deepEqual(
    items.map((i) => [i.label, i.unit, i.isTitle]),
    [
      ["A", "kg", false],
      ["B", "m²", false],
      ["C", "ml", false],
      ["D", "Ft", true],
      ["E (type A)", null, false],
      ["F", null, false],
      ["G", null, false],
    ]
  );
});

test("round trip yields no change, legacy rows included", () => {
  const text = serializeBusinessObjectsTree(OBJECTS);
  const { count } = buildQuickEditDiff({
    listing,
    businessObjects: OBJECTS,
    text,
  });
  assert.equal(count, 0);
});

test("unit change is a free text patch", () => {
  const text = serializeBusinessObjectsTree(OBJECTS).replace("(ens)", "(kg)");
  const { changes, plan } = buildQuickEditDiff({
    listing,
    businessObjects: OBJECTS,
    text,
  });
  assert.deepEqual(changes.map((c) => c.kinds), [["UNIT"]]);
  assert.deepEqual(plan.updates, [{ id: "d", patch: { unit: "kg" } }]);
});
