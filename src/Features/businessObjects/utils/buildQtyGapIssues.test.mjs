import { test } from "node:test";
import assert from "node:assert/strict";

import buildQtyGapIssues from "./buildQtyGapIssues.js";

const object = (props) => ({
  id: "o1",
  code: "4.1.4.",
  label: "Dépose membrane",
  unit: "M²",
  refQty: 100,
  ...props,
});

const qties = (surface, length = 0, count = 1) => ({ count, length, surface });

test("raises an issue above the 5 % threshold", () => {
  const issues = buildQtyGapIssues({
    businessObjects: [object()],
    qtiesByObjectId: { o1: qties(120) },
    annotationsByObjectId: { o1: [{ id: "a1" }, { id: "a2" }] },
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].label, "Écart de quantité — 4.1.4. Dépose membrane");
  assert.deepEqual(issues[0].annotationIds, ["a1", "a2"]);
  assert.match(issues[0].description, /référence : 100 M²/);
  assert.match(issues[0].description, /calculée : 120 M²/);
  assert.match(issues[0].description, /\+20 M² \(\+20 %\)/);
});

test("stays silent within the threshold", () => {
  const issues = buildQtyGapIssues({
    businessObjects: [object()],
    qtiesByObjectId: { o1: qties(104) },
    annotationsByObjectId: { o1: [{ id: "a1" }] },
  });
  assert.deepEqual(issues, []);
});

test("skips titles, objects without refQty and objects without annotation", () => {
  const issues = buildQtyGapIssues({
    businessObjects: [
      object({ id: "t", isTitle: true }),
      object({ id: "noRef", refQty: undefined }),
      object({ id: "noAnn" }),
    ],
    qtiesByObjectId: { t: qties(500), noRef: qties(500) },
    annotationsByObjectId: { t: [{ id: "a1" }], noRef: [{ id: "a2" }] },
  });
  assert.deepEqual(issues, []);
});

test("compares in the kind of the unit", () => {
  const issues = buildQtyGapIssues({
    businessObjects: [object({ unit: "ml", refQty: 10 })],
    qtiesByObjectId: { o1: qties(500, 8) },
    annotationsByObjectId: { o1: [{ id: "a1" }] },
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].description, /-2 ml \(-20 %\)/);
});
