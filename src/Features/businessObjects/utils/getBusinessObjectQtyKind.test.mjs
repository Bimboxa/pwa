import test from "node:test";
import assert from "node:assert/strict";

import getBusinessObjectQtyKind, {
  getBusinessObjectUnitText,
} from "./getBusinessObjectQtyKind.js";
import getBusinessObjectQtyLabel from "./getBusinessObjectQtyLabel.js";

test("quantity kind deduced from the unit text", () => {
  for (const unit of ["m²", "m2", " M2 ", "M²", "S"])
    assert.equal(getBusinessObjectQtyKind(unit), "SURFACE");
  for (const unit of ["ml", "ML", "m", "m.l.", "L"])
    assert.equal(getBusinessObjectQtyKind(unit), "LENGTH");
  // lowercase "l" / "s" are plain texts (litre...), not the legacy keys
  for (const unit of ["u", "U", "ens", "Ens.", "kg", "Ft", "l", "s", "m3"])
    assert.equal(getBusinessObjectQtyKind(unit), "COUNT");
  for (const unit of [null, undefined, "", "  ", 3])
    assert.equal(getBusinessObjectQtyKind(unit), null);
});

test("unit text", () => {
  assert.equal(getBusinessObjectUnitText("S"), "m²");
  assert.equal(getBusinessObjectUnitText("L"), "ml");
  assert.equal(getBusinessObjectUnitText("U"), "u");
  assert.equal(getBusinessObjectUnitText(" Ens. "), "Ens.");
  assert.equal(getBusinessObjectUnitText(null), "");
});

test("quantity label", () => {
  const qties = { count: 3, length: 12.54, surface: 40 };
  assert.equal(getBusinessObjectQtyLabel("ens", qties), "3 ens");
  assert.equal(getBusinessObjectQtyLabel("ml", qties), "12,5 ml");
  assert.equal(getBusinessObjectQtyLabel("S", qties), "40 m²");
  assert.equal(getBusinessObjectQtyLabel(null, qties), null);
});
