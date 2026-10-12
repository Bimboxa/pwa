import test from "node:test";
import assert from "node:assert/strict";

import {
  addLinkedTemplateIds,
  getLinkedTemplateIds,
  isTemplateLinked,
  removeLinkedTemplateId,
} from "./linkedTemplateIds.js";

test("getLinkedTemplateIds dedupes and drops non-string entries", () => {
  assert.deepEqual(getLinkedTemplateIds(null), []);
  assert.deepEqual(getLinkedTemplateIds({}), []);
  assert.deepEqual(getLinkedTemplateIds({ linkedTemplateIds: "t1" }), []);
  assert.deepEqual(
    getLinkedTemplateIds({
      linkedTemplateIds: ["t1", "t2", "t1", null, 3, ""],
    }),
    ["t1", "t2"]
  );
});

test("isTemplateLinked", () => {
  const object = { linkedTemplateIds: ["t1"] };
  assert.equal(isTemplateLinked(object, "t1"), true);
  assert.equal(isTemplateLinked(object, "t2"), false);
  assert.equal(isTemplateLinked(object, null), false);
  assert.equal(isTemplateLinked(object, ""), false);
});

test("addLinkedTemplateIds keeps the order and dedupes", () => {
  const object = { linkedTemplateIds: ["t1"] };
  assert.deepEqual(addLinkedTemplateIds(object, ["t2", "t1", "t3"]), [
    "t1",
    "t2",
    "t3",
  ]);
  // the object is not mutated
  assert.deepEqual(object.linkedTemplateIds, ["t1"]);
  assert.deepEqual(addLinkedTemplateIds({}, ["t1"]), ["t1"]);
});

test("removeLinkedTemplateId", () => {
  const object = { linkedTemplateIds: ["t1", "t2"] };
  assert.deepEqual(removeLinkedTemplateId(object, "t1"), ["t2"]);
  assert.deepEqual(removeLinkedTemplateId(object, "t9"), ["t1", "t2"]);
  assert.deepEqual(object.linkedTemplateIds, ["t1", "t2"]);
});
