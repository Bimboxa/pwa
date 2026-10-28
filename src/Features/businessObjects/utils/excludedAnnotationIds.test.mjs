import test from "node:test";
import assert from "node:assert/strict";

import {
  addExcludedAnnotationIds,
  getExcludedAnnotationIds,
  isAnnotationExcluded,
  isExclusionApplicable,
  removeExcludedAnnotationIds,
} from "./excludedAnnotationIds.js";

test("getExcludedAnnotationIds dedupes and drops non-string entries", () => {
  assert.deepEqual(getExcludedAnnotationIds(null), []);
  assert.deepEqual(getExcludedAnnotationIds({}), []);
  assert.deepEqual(
    getExcludedAnnotationIds({ excludedAnnotationIds: "a1" }),
    []
  );
  assert.deepEqual(
    getExcludedAnnotationIds({
      excludedAnnotationIds: ["a1", "a2", "a1", null, 3, ""],
    }),
    ["a1", "a2"]
  );
});

test("isAnnotationExcluded", () => {
  const object = { excludedAnnotationIds: ["a1"] };
  assert.equal(isAnnotationExcluded(object, "a1"), true);
  assert.equal(isAnnotationExcluded(object, "a2"), false);
  assert.equal(isAnnotationExcluded(object, null), false);
});

test("addExcludedAnnotationIds keeps the order and dedupes", () => {
  const object = { excludedAnnotationIds: ["a1"] };
  assert.deepEqual(addExcludedAnnotationIds(object, ["a2", "a1", "a3"]), [
    "a1",
    "a2",
    "a3",
  ]);
  // the object is not mutated
  assert.deepEqual(object.excludedAnnotationIds, ["a1"]);
  assert.deepEqual(addExcludedAnnotationIds({}, ["a1"]), ["a1"]);
});

test("removeExcludedAnnotationIds", () => {
  const object = { excludedAnnotationIds: ["a1", "a2", "a3"] };
  assert.deepEqual(removeExcludedAnnotationIds(object, ["a1", "a3"]), ["a2"]);
  assert.deepEqual(removeExcludedAnnotationIds(object, ["a9"]), [
    "a1",
    "a2",
    "a3",
  ]);
  assert.deepEqual(object.excludedAnnotationIds, ["a1", "a2", "a3"]);
});

test("isExclusionApplicable: template linked, non-cell annotations only", () => {
  const object = { linkedTemplateIds: ["t1"] };
  assert.equal(
    isExclusionApplicable(object, { id: "a1", annotationTemplateId: "t1" }),
    true
  );
  assert.equal(
    isExclusionApplicable(object, { id: "a2", annotationTemplateId: "t2" }),
    false
  );
  assert.equal(
    isExclusionApplicable(object, {
      id: "c1",
      annotationTemplateId: "t1",
      isMeshCell: true,
    }),
    false
  );
  assert.equal(
    isExclusionApplicable(object, { id: "f1", annotationTemplateId: null }),
    false
  );
  assert.equal(isExclusionApplicable(object, null), false);
  assert.equal(
    isExclusionApplicable({}, { id: "a1", annotationTemplateId: "t1" }),
    false
  );
});
