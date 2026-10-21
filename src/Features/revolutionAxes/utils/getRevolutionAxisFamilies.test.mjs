import assert from "node:assert/strict";
import { test } from "node:test";

import getRevolutionAxisFamilies, {
  getRevolutionAxisFamiliesOfBaseMap,
} from "./getRevolutionAxisFamilies.js";

const axis = (id, baseMapId, extra = {}) => ({
  id,
  type: "REVOLUTION_AXIS",
  baseMapId,
  ...extra,
});
const placement = (id, baseMapId, revolutionAxisId, extra = {}) => ({
  id,
  type: "REVOLUTION_AXIS_PLACEMENT",
  baseMapId,
  revolutionAxisId,
  ...extra,
});

test("axis without placement → family with an empty placement list", () => {
  const families = getRevolutionAxisFamilies([axis("a1", "plan")]);
  assert.deepEqual(families.get("a1"), {
    axisId: "a1",
    planBaseMapId: "plan",
    placementBaseMapIds: [],
  });
});

test("several elevations on one axis, each base map listed once", () => {
  const families = getRevolutionAxisFamilies([
    axis("a1", "plan"),
    placement("p1", "coupeA", "a1"),
    placement("p2", "coupeB", "a1"),
    placement("p3", "coupeA", "a1"), // duplicate map (stale placement)
    { id: "x", type: "POLYLINE", baseMapId: "coupeA" },
  ]);
  assert.equal(families.size, 1);
  assert.deepEqual(families.get("a1").placementBaseMapIds, [
    "coupeA",
    "coupeB",
  ]);
});

test("placement whose axis is not in the list still yields a family", () => {
  const families = getRevolutionAxisFamilies([placement("p1", "coupe", "a9")]);
  assert.deepEqual(families.get("a9"), {
    axisId: "a9",
    planBaseMapId: null,
    placementBaseMapIds: ["coupe"],
  });
});

test("deleted rows and orphan placements are ignored", () => {
  const families = getRevolutionAxisFamilies([
    axis("a1", "plan", { deletedAt: "2026-01-01" }),
    placement("p1", "coupe", "a1", { deletedAt: "2026-01-01" }),
    placement("p2", "coupe", undefined),
    null,
  ]);
  assert.equal(families.size, 0);
});

test("families of a base map carry its role", () => {
  const list = [
    axis("a1", "plan"),
    placement("p1", "coupeA", "a1"),
    axis("a2", "coupeA"), // an axis drawn on coupeA itself
    placement("p2", "coupeB", "a2"),
  ];
  const ofCoupeA = getRevolutionAxisFamiliesOfBaseMap(list, "coupeA");
  assert.equal(ofCoupeA.length, 2);
  const byAxis = Object.fromEntries(ofCoupeA.map((e) => [e.family.axisId, e]));
  assert.equal(byAxis.a1.isPlacement, true);
  assert.equal(byAxis.a1.isPlan, false);
  assert.equal(byAxis.a2.isPlan, true);
  assert.equal(byAxis.a2.isPlacement, false);
  assert.deepEqual(getRevolutionAxisFamiliesOfBaseMap(list, "none"), []);
  assert.deepEqual(getRevolutionAxisFamiliesOfBaseMap(list, null), []);
});
