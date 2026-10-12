import test from "node:test";
import assert from "node:assert/strict";

import resolveBusinessObjectAnnotationLinks from "./resolveBusinessObjectAnnotationLinks.js";

const a1 = { id: "a1", annotationTemplateId: "t1" };
const a2 = { id: "a2", annotationTemplateId: "t1" };
const a3 = { id: "a3", annotationTemplateId: "t2" };
const cell = { id: "c1", annotationTemplateId: "t1", isMeshCell: true };
const free = { id: "f1", annotationTemplateId: null };
const annotations = [a1, a2, a3, cell, free];

function rows(result, objectId) {
  return result.rowsByObjectId[objectId] ?? [];
}

test("rels only (no businessObjects)", () => {
  const result = resolveBusinessObjectAnnotationLinks({
    rels: [
      { id: "r1", annotationId: "a1", businessObjectId: "o1", isMain: true },
      { id: "r2", annotationId: "c1", businessObjectId: "o1" },
      { id: "r3", annotationId: "missing", businessObjectId: "o1" },
    ],
    annotations,
  });
  const o1 = rows(result, "o1");
  assert.deepEqual(
    o1.map((r) => r.annotation.id),
    ["a1", "c1"]
  );
  assert.equal(o1[0].rel.id, "r1");
  assert.equal(o1[0].byAnnotation, true);
  assert.equal(o1[0].byTemplate, false);
  // a rel-linked mesh cell stays listed (the counting skips it later)
  assert.equal(o1[1].annotation.isMeshCell, true);
});

test("template link expands to every non-cell annotation of the template", () => {
  const result = resolveBusinessObjectAnnotationLinks({
    rels: [],
    annotations,
    businessObjects: [{ id: "o1", linkedTemplateIds: ["t1"] }],
  });
  const o1 = rows(result, "o1");
  assert.deepEqual(
    o1.map((r) => r.annotation.id),
    ["a1", "a2"]
  );
  o1.forEach((row) => {
    assert.equal(row.rel, null);
    assert.equal(row.byAnnotation, false);
    assert.equal(row.byTemplate, true);
  });
});

test("rel + template on the same annotation = one row with both flags", () => {
  const rel = { id: "r1", annotationId: "a1", businessObjectId: "o1" };
  const result = resolveBusinessObjectAnnotationLinks({
    rels: [rel],
    annotations,
    businessObjects: [{ id: "o1", linkedTemplateIds: ["t1"] }],
  });
  const o1 = rows(result, "o1");
  assert.equal(o1.length, 2);
  const row = o1.find((r) => r.annotation.id === "a1");
  assert.equal(row.rel, rel);
  assert.equal(row.byAnnotation, true);
  assert.equal(row.byTemplate, true);
});

test("stale template id and templateless annotations are ignored", () => {
  const result = resolveBusinessObjectAnnotationLinks({
    rels: [],
    annotations,
    businessObjects: [{ id: "o1", linkedTemplateIds: ["deleted"] }],
  });
  assert.deepEqual(rows(result, "o1"), []);
  assert.equal(result.rowsByObjectId.o1, undefined);
});

test("objects are independent", () => {
  const result = resolveBusinessObjectAnnotationLinks({
    rels: [{ id: "r1", annotationId: "a3", businessObjectId: "o2" }],
    annotations,
    businessObjects: [
      { id: "o1", linkedTemplateIds: ["t1"] },
      { id: "o2", linkedTemplateIds: ["t2"] },
    ],
  });
  assert.deepEqual(
    rows(result, "o1").map((r) => r.annotation.id),
    ["a1", "a2"]
  );
  assert.deepEqual(
    rows(result, "o2").map((r) => r.annotation.id),
    ["a3"]
  );
  assert.equal(rows(result, "o2")[0].byAnnotation, true);
  assert.equal(rows(result, "o2")[0].byTemplate, true);
});
