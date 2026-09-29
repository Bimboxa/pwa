import test from "node:test";
import assert from "node:assert/strict";

import parsePromptIaBusinessObjects from "./parsePromptIaBusinessObjects.js";

const SAMPLE = {
  version: "1.0",
  listingName: " DPGF Lot 01 ",
  note: "ok",
  businessObjects: [
    { id: "o1", parentId: null, code: "4.", label: "CETA", isTitle: true },
    { id: "o2", parentId: "o1", code: "4.1.", label: "Prépa", isTitle: true },
    {
      id: "o3",
      parentId: "o2",
      code: "4.1.4.",
      label: "Dépose  membrane\nPVC",
      unit: "S",
      refUnit: "M²",
      refQty: 404,
    },
    {
      id: "o4",
      parentId: "o2",
      code: "4.1.7.",
      label: "Dépose bande de rive",
      refUnit: "Ens.",
      refQty: "1,5",
    },
    { id: "o5", parentId: "o1", label: "Objet" },
  ],
};

test("parses a flat list with hierarchy, counts and depth", () => {
  const result = parsePromptIaBusinessObjects(SAMPLE);
  assert.equal(result.ok, true);
  assert.equal(result.listingName, "DPGF Lot 01");
  assert.equal(result.note, "ok");
  assert.deepEqual(result.counts, { objects: 3, titles: 2 });
  assert.deepEqual(
    result.items.map((i) => [i.ref, i.depth]),
    [
      ["o1", 0],
      ["o2", 1],
      ["o3", 2],
      ["o4", 2],
      ["o5", 1],
    ]
  );
  assert.equal(result.items[2].label, "Dépose membrane PVC");
});

test("units are free texts, quantities are numbers", () => {
  const { items } = parsePromptIaBusinessObjects(SAMPLE);
  // the source unit (legacy `refUnit`) wins over the enum key
  assert.equal(items[2].unit, "M²");
  assert.equal(items[3].unit, "Ens.");
  assert.equal("refUnit" in items[3], false);
  assert.equal(items[3].refQty, 1.5);
  assert.equal(items[4].unit, null);
  assert.equal(items[4].refQty, null);
});

test("`unit` is kept as written, legacy keys read as labels", () => {
  const { items } = parsePromptIaBusinessObjects({
    businessObjects: [
      { id: "a", label: "A", unit: " m2 " },
      { id: "b", label: "B", unit: "kg" },
      { id: "c", label: "C", unit: "S" },
      { id: "d", label: "D", unit: "L" },
      { id: "e", label: "E", unit: "" },
    ],
  });
  assert.deepEqual(
    items.map((i) => i.unit),
    ["m2", "kg", "m²", "ml", null]
  );
});

test("regroups a child listed away from its parent", () => {
  const { items } = parsePromptIaBusinessObjects({
    businessObjects: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "a1", parentId: "a", label: "A1" },
    ],
  });
  assert.deepEqual(
    items.map((i) => i.ref),
    ["a", "a1", "b"]
  );
});

test("unknown parent falls back to root with a warning", () => {
  const result = parsePromptIaBusinessObjects({
    businessObjects: [{ id: "a", parentId: "zz", label: "A" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.items[0].parentRef, null);
  assert.equal(result.warnings.length, 1);
});

test("duplicate ids and unlabeled rows", () => {
  const result = parsePromptIaBusinessObjects({
    businessObjects: [
      { id: "a", label: "A" },
      { id: "a", label: "A bis" },
      { id: "b", label: "  " },
      null,
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 2);
  assert.notEqual(result.items[0].ref, result.items[1].ref);
  assert.equal(result.warnings.length, 2);
});

test("errors", () => {
  assert.equal(parsePromptIaBusinessObjects([]).ok, false);
  assert.equal(parsePromptIaBusinessObjects({}).ok, false);
  assert.equal(parsePromptIaBusinessObjects({ businessObjects: [] }).ok, false);
  assert.equal(
    parsePromptIaBusinessObjects({ businessObjects: [{ id: "a" }] }).ok,
    false
  );
  const cycle = parsePromptIaBusinessObjects({
    businessObjects: [
      { id: "a", parentId: "b", label: "A" },
      { id: "b", parentId: "a", label: "B" },
    ],
  });
  assert.equal(cycle.ok, false);
  assert.match(cycle.error, /circulaire/);
});
