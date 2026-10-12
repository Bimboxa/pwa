import test from "node:test";
import assert from "node:assert/strict";

import computeBusinessObjectQties from "./computeBusinessObjectQties.js";

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
const annotations = [a1, a2, a3, cell];

test("rels only: unchanged behavior", () => {
  const { qtiesByObjectId, annotationsByObjectId, mainRelsByObjectId } =
    computeBusinessObjectQties({
      rels: [
        { id: "r1", annotationId: "a1", businessObjectId: "o1", isMain: true },
        { id: "r2", annotationId: "c1", businessObjectId: "o1" },
      ],
      annotations,
      businessObjects: [{ id: "o1", unit: "m²" }],
    });
  assert.equal(qtiesByObjectId.o1.surface, 10);
  assert.equal(qtiesByObjectId.o1.count, 1);
  assert.deepEqual(
    annotationsByObjectId.o1.map((a) => a.id),
    ["a1"]
  );
  assert.equal(mainRelsByObjectId.o1.length, 1);
});

test("template link: every annotation of the template counted once", () => {
  const { qtiesByObjectId, annotationsByObjectId, mainRelsByObjectId } =
    computeBusinessObjectQties({
      rels: [
        { id: "r1", annotationId: "a1", businessObjectId: "o1", isMain: true },
      ],
      annotations,
      businessObjects: [{ id: "o1", unit: "m²", linkedTemplateIds: ["t1"] }],
    });
  // a1 (rel + template) + a2 (template), the mesh cell skipped
  assert.equal(qtiesByObjectId.o1.surface, 30);
  assert.equal(qtiesByObjectId.o1.count, 2);
  assert.deepEqual(annotationsByObjectId.o1.map((a) => a.id).sort(), [
    "a1",
    "a2",
  ]);
  // the main rel is still reported
  assert.equal(mainRelsByObjectId.o1[0].id, "r1");
});

test("template link + custom formula per annotation", () => {
  const { qtiesByObjectId } = computeBusinessObjectQties({
    rels: [],
    annotations,
    businessObjects: [
      {
        id: "o1",
        unit: "m²",
        linkedTemplateIds: ["t1", "t2"],
        qtyFormulas: [{ annotationTemplateId: "t1", formula: "S * 1.1" }],
      },
    ],
  });
  const q = qtiesByObjectId.o1;
  assert.equal(q.surface, 35);
  // formula share: t1 annotations (10 + 20) × 1.1
  assert.equal(q.formula.surface, 30);
  assert.ok(Math.abs(q.formula.value - 33) < 1e-9);
});

test("template link + constant formula counted once per template", () => {
  const { qtiesByObjectId } = computeBusinessObjectQties({
    rels: [],
    annotations,
    businessObjects: [
      {
        id: "o1",
        unit: "m²",
        linkedTemplateIds: ["t1"],
        qtyFormulas: [{ annotationTemplateId: "t1", formula: "100" }],
      },
    ],
  });
  assert.equal(qtiesByObjectId.o1.formula.value, 100);
  assert.equal(qtiesByObjectId.o1.formula.surface, 30);
});

test("stale template id: nothing counted", () => {
  const { qtiesByObjectId } = computeBusinessObjectQties({
    rels: [],
    annotations,
    businessObjects: [{ id: "o1", unit: "m²", linkedTemplateIds: ["gone"] }],
  });
  assert.equal(qtiesByObjectId.o1, undefined);
});
