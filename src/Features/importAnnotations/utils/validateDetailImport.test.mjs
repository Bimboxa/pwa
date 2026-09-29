import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateDetailAnnotation,
  validateImportBaseMaps,
} from "./validateDetailImport.js";

const bubble = {
  id: "d1",
  type: "DETAIL",
  point: { x: 0.4, y: 0.3 },
  arrowAngle: 135,
  detailBaseMapId: "bm_A",
};
const baseMap = {
  id: "bm_A",
  kind: "detail",
  name: "Détail A",
  detailRef: "A",
  source: {
    attachmentId: "res-1",
    pageNumber: 3,
    rotation: 0,
    bboxInRatio: { x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.7 },
  },
};

test("a DETAIL needs one normalized point and nothing else geometric", () => {
  assert.equal(validateDetailAnnotation(bubble), null);
  assert.equal(
    validateDetailAnnotation({ ...bubble, arrowAngle: undefined, detailBaseMapId: undefined }),
    null
  );
  assert.match(validateDetailAnnotation({ ...bubble, point: undefined }), /`point`/);
  assert.match(validateDetailAnnotation({ ...bubble, point: { x: 1.2, y: 0 } }), /normalisées/);
  assert.match(
    validateDetailAnnotation({ ...bubble, points: [{ x: 0, y: 0 }] }),
    /pas de `points`/
  );
  assert.match(validateDetailAnnotation({ ...bubble, arrowAngle: "90" }), /arrowAngle/);
  assert.match(validateDetailAnnotation({ ...bubble, detailBaseMapId: " " }), /detailBaseMapId/);
});

test("baseMaps is optional and accepts a whole page", () => {
  assert.equal(validateImportBaseMaps(undefined), null);
  assert.equal(validateImportBaseMaps([]), null);
  assert.equal(validateImportBaseMaps([baseMap]), null);
  assert.equal(
    validateImportBaseMaps([
      { id: "b", kind: "detail", source: { attachmentId: "r", pageNumber: 1, bboxInRatio: null } },
    ]),
    null
  );
});

test("baseMaps entries are checked one by one", () => {
  const bad = (patch, source) =>
    validateImportBaseMaps([
      { ...baseMap, ...patch, source: { ...baseMap.source, ...source } },
    ]);
  assert.match(validateImportBaseMaps({}), /tableau/);
  assert.match(validateImportBaseMaps([baseMap, baseMap]), /en double/);
  assert.match(bad({ kind: "baseMap" }), /kind/);
  assert.match(bad({ detailRef: "x".repeat(21) }), /detailRef/);
  assert.match(bad({}, { attachmentId: "" }), /attachmentId/);
  assert.match(bad({}, { pageNumber: 0 }), /pageNumber/);
  assert.match(bad({}, { pageNumber: 1.5 }), /pageNumber/);
  assert.match(bad({}, { rotation: 45 }), /rotation/);
  assert.match(bad({}, { bboxInRatio: { x1: 0.6, y1: 0.2, x2: 0.1, y2: 0.7 } }), /bboxInRatio/);
  assert.match(bad({}, { bboxInRatio: { x1: 0, y1: 0, x2: 1.2, y2: 1 } }), /bboxInRatio/);
  assert.match(
    validateImportBaseMaps(
      Array.from({ length: 201 }, (_, i) => ({ ...baseMap, id: `b${i}` }))
    ),
    /200/
  );
});
