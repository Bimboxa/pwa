import test from "node:test";
import assert from "node:assert/strict";

import getBusinessObjectStateId from "./getBusinessObjectStateId.js";

const fields = [
  { id: "f1", type: "state", stateModelId: "sm1" },
  { id: "f2", type: "freeText" },
];

test("local field value wins over the Krnet snapshot", () => {
  const o = {
    fieldValues: { f1: "s2" },
    notesAppRemote: { stateValues: { sm1: "s1" } },
  };
  assert.equal(getBusinessObjectStateId(o, "sm1", fields), "s2");
});

test("a local key set to null means no state (snapshot hidden)", () => {
  const o = {
    fieldValues: { f1: null },
    notesAppRemote: { stateValues: { sm1: "s1" } },
  };
  assert.equal(getBusinessObjectStateId(o, "sm1", fields), null);
});

test("falls back to the snapshot, even without a bound field", () => {
  const o = { notesAppRemote: { stateValues: { sm1: "s1", sm2: "x" } } };
  assert.equal(getBusinessObjectStateId(o, "sm1", fields), "s1");
  assert.equal(getBusinessObjectStateId(o, "sm2", fields), "x");
  assert.equal(getBusinessObjectStateId(o, "sm3", fields), null);
});

test("no object / no model → null", () => {
  assert.equal(getBusinessObjectStateId(null, "sm1", fields), null);
  assert.equal(getBusinessObjectStateId({}, null, fields), null);
  assert.equal(getBusinessObjectStateId({}, "sm1"), null);
});
