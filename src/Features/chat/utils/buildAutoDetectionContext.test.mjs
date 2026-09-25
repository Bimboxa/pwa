import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getVisibleListingTemplates,
  buildExistingAnnotations,
} from "./buildAutoDetectionContext.js";

test("Auto includes only visible current-listing models, even with no annotations", () => {
  const templates = [
    {
      id: "visible",
      listingId: "current",
      description: "Concrete walls",
      hiddenInLegend: true,
    },
    { id: "hidden", listingId: "current", hidden: true },
    { id: "deleted", listingId: "current", deletedAt: "today" },
    { id: "other", listingId: "other" },
  ];
  assert.deepEqual(getVisibleListingTemplates(templates, "current"), [
    templates[0],
  ]);
  assert.deepEqual(getVisibleListingTemplates(templates, null), []);
});

test("Existing annotations retain resolved pixels and holes, exclude other lists/maps and private fields", () => {
  const annotation = {
    id: "a",
    listingId: "l",
    baseMapId: "b",
    type: "POLYLINE",
    annotationTemplateId: "t",
    points: [{ x: 300, y: 40 }],
    cuts: [{ points: [{ x: 310, y: 50 }] }],
    entity: { private: true },
  };
  const result = buildExistingAnnotations(
    [
      annotation,
      { ...annotation, hidden: true },
      { ...annotation, listingId: "other" },
      { ...annotation, baseMapId: "other" },
    ],
    "l",
    "b"
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].geometry.points, annotation.points);
  assert.deepEqual(result[0].geometry.cuts, annotation.cuts);
  assert.equal(result[0].entity, undefined);
  assert.equal(result[0].annotationTemplateId, "t");
  assert.equal(result[0].lockedFields, undefined);
});

test("Existing annotation geometry is rounded to 1 mm of the plan", () => {
  const annotation = {
    id: "a",
    listingId: "l",
    baseMapId: "b",
    type: "POLYLINE",
    points: [{ x: 300.123456, y: 40.987654 }],
    radius: 12.3456789,
    strokeWidth: 0.5,
    annotationTemplateProps: { overrideFields: ["strokeColor"] },
  };
  // 0.005 m/px: 0.1 px = 0.5 mm → 1 decimal.
  const [rounded] = buildExistingAnnotations([annotation], "l", "b", 0.005);
  assert.deepEqual(rounded.geometry.points, [{ x: 300.1, y: 41 }]);
  assert.equal(rounded.geometry.radius, 12.3);
  assert.equal(rounded.geometry.strokeWidth, 0.5);
  assert.deepEqual(rounded.lockedFields, ["strokeColor"]);
  // Uncalibrated: 3 decimals.
  const [raw] = buildExistingAnnotations([annotation], "l", "b", null);
  assert.deepEqual(raw.geometry.points, [{ x: 300.123, y: 40.988 }]);
});
