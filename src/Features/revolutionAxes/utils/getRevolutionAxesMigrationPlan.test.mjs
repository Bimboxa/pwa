import assert from "node:assert/strict";
import { test } from "node:test";

import getRevolutionAxesMigrationPlan from "./getRevolutionAxesMigrationPlan.js";

const templates = [
  { id: "tAxis", listingId: "l1", drawingShape: "REVOLUTION_AXIS" },
  { id: "tShared", listingId: "l1", drawingShape: "REVOLUTION_AXIS" },
];
const scopeIdByListingId = new Map([["l1", "s1"]]);

test("axes and placements are detached, empty templates removed", () => {
  const annotations = [
    {
      id: "axis",
      type: "REVOLUTION_AXIS",
      listingId: "l1",
      annotationTemplateId: "tAxis",
      layerId: "layer1",
    },
    {
      id: "placement",
      type: "REVOLUTION_AXIS_PLACEMENT",
      listingId: "l1",
      annotationTemplateId: "tAxis",
      revolutionAxisId: "axis",
    },
    // a live non-helper row riding an axis template (e.g. a procedure datum)
    { id: "line", type: "POLYLINE", listingId: "l1", annotationTemplateId: "tShared" },
    { id: "axis2", type: "REVOLUTION_AXIS", listingId: "l1", annotationTemplateId: "tShared" },
  ];
  const { updates, templateIdsToDelete } = getRevolutionAxesMigrationPlan({
    annotations,
    templates,
    scopeIdByListingId,
  });
  assert.deepEqual(
    updates.map((u) => u.id),
    ["axis", "placement", "axis2"]
  );
  assert.deepEqual(updates[0].changes, {
    scopeId: "s1",
    listingId: null,
    annotationTemplateId: null,
    layerId: null,
  });
  assert.deepEqual(templateIdsToDelete, ["tAxis"]);
});

test("a row whose listing is gone keeps its template", () => {
  const { updates, templateIdsToDelete } = getRevolutionAxesMigrationPlan({
    annotations: [
      { id: "axis", type: "REVOLUTION_AXIS", listingId: "gone", annotationTemplateId: "tAxis" },
    ],
    templates,
    scopeIdByListingId,
  });
  assert.equal(updates.length, 0);
  assert.deepEqual(templateIdsToDelete, ["tShared"]);
});

test("second pass is a no-op (migrated rows carry no template id)", () => {
  const { updates, templateIdsToDelete } = getRevolutionAxesMigrationPlan({
    annotations: [
      { id: "axis", type: "REVOLUTION_AXIS", scopeId: "s1", listingId: null, annotationTemplateId: null },
    ],
    templates: [],
    scopeIdByListingId,
  });
  assert.equal(updates.length, 0);
  assert.equal(templateIdsToDelete.length, 0);
});
