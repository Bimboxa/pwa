import test from "node:test";
import assert from "node:assert/strict";

import getBusinessObjectQtiesByTemplate from "./getBusinessObjectQtiesByTemplate.js";

const qties = (surface) => ({ enabled: true, surface, length: 0, count: 1 });

const a1 = { id: "a1", annotationTemplateId: "t1", qties: qties(10) };
const a2 = { id: "a2", annotationTemplateId: "t1", qties: qties(20) };
const a3 = { id: "a3", annotationTemplateId: "t2", qties: qties(5) };
const cell = {
  id: "c1",
  annotationTemplateId: "t1",
  isMeshCell: true,
  qties: qties(99),
};
const free = { id: "f1", annotationTemplateId: null, qties: qties(1) };

test("rows in first-seen order, mesh cells listed not counted", () => {
  const rows = getBusinessObjectQtiesByTemplate([a1, a3, cell, free, a2], {
    unit: "m²",
  });
  assert.deepEqual(
    rows.map((r) => r.annotationTemplateId),
    ["t1", "t2", null]
  );
  const t1 = rows[0];
  assert.equal(t1.annotationsCount, 2);
  assert.equal(t1.annotations.length, 3);
  assert.equal(t1.qties.surface, 30);
  assert.equal(t1.isLinkedByTemplate, false);
  // no relAnnotationIds option => null
  assert.equal(t1.relLinkedCount, null);
  assert.equal(t1.formula, null);
});

test("relLinkedCount with the option", () => {
  const rows = getBusinessObjectQtiesByTemplate(
    [a1, a2, a3],
    { unit: "m²" },
    { relAnnotationIds: new Set(["a1", "a3"]) }
  );
  assert.equal(rows[0].relLinkedCount, 1);
  assert.equal(rows[1].relLinkedCount, 1);
});

test("isLinkedByTemplate + empty row for a linked template without annotation", () => {
  const rows = getBusinessObjectQtiesByTemplate(
    [a1, a2],
    { unit: "m²", linkedTemplateIds: ["t1", "t9"] },
    { relAnnotationIds: new Set() }
  );
  assert.deepEqual(
    rows.map((r) => r.annotationTemplateId),
    ["t1", "t9"]
  );
  assert.equal(rows[0].isLinkedByTemplate, true);
  assert.equal(rows[0].relLinkedCount, 0);
  assert.equal(rows[1].isLinkedByTemplate, true);
  assert.equal(rows[1].annotationsCount, 0);
  assert.deepEqual(rows[1].annotations, []);
  assert.equal(rows[1].qties.surface, 0);
});

test("custom formula still reported", () => {
  const rows = getBusinessObjectQtiesByTemplate([a1], {
    unit: "m²",
    qtyFormulas: [{ annotationTemplateId: "t1", formula: "S * 2" }],
  });
  assert.equal(rows[0].formula, "S * 2");
  assert.equal(rows[0].qties.formula.value, 20);
});
