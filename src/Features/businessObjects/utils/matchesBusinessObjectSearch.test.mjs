import test from "node:test";
import assert from "node:assert/strict";

import matchesBusinessObjectSearch from "./matchesBusinessObjectSearch.js";

test("empty query matches everything", () => {
  assert.equal(matchesBusinessObjectSearch({ label: "Parking" }, ""), true);
  assert.equal(matchesBusinessObjectSearch({ label: "Parking" }, "  "), true);
  assert.equal(matchesBusinessObjectSearch({}, null), true);
});

test("case- and accent-insensitive match on the label", () => {
  const o = { label: "Cage d’élévateur" };
  assert.equal(matchesBusinessObjectSearch(o, "ELEV"), true);
  assert.equal(matchesBusinessObjectSearch(o, "élév"), true);
  assert.equal(matchesBusinessObjectSearch(o, "zone"), false);
});

test("matches on the code too", () => {
  const o = { label: "Zone A", code: "LOC-012" };
  assert.equal(matchesBusinessObjectSearch(o, "loc-01"), true);
  assert.equal(matchesBusinessObjectSearch(o, "zo"), true);
  assert.equal(matchesBusinessObjectSearch({ label: "Zone B" }, "loc"), false);
});
