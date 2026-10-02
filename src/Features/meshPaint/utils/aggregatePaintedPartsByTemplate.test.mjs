import assert from "node:assert/strict";
import { test } from "node:test";

import aggregatePaintedPartsByTemplate from "./aggregatePaintedPartsByTemplate.js";

const part = (id, extra) => ({
  id,
  annotationTemplateId: "tA",
  listingId: "L1",
  partType: "FACE",
  status: "OK",
  isCounted: true,
  isOrphan: false,
  isConflict: false,
  isStale: false,
  qtiesEnabled: true,
  surface: 0,
  length: 0,
  ...extra,
});

test("sums counted parts only; every part stays listed", () => {
  const parts = [
    part("p1", { surface: 2.5 }),
    part("p2", { surface: 1.5, isStale: true }),
    part("p3", {
      surface: 9,
      status: "ORPHAN",
      isCounted: false,
      isOrphan: true,
    }),
    part("p4", {
      surface: 7,
      status: "CONFLICT",
      isCounted: false,
      isConflict: true,
    }),
    // no scale on its base map: counted part, no quantity
    part("p5", { qtiesEnabled: false, surface: 0 }),
    part("e1", {
      annotationTemplateId: "tB",
      listingId: "L2",
      partType: "EDGE",
      length: 3.2,
    }),
  ];
  const { byTemplateId, countsByListingId, templateIds, listingIds } =
    aggregatePaintedPartsByTemplate(parts);

  const a = byTemplateId.tA;
  assert.equal(a.surface, 4);
  assert.equal(a.length, 0);
  assert.equal(a.partsCount, 3);
  assert.equal(a.facesCount, 3);
  assert.equal(a.edgesCount, 0);
  assert.equal(a.orphansCount, 1);
  assert.equal(a.conflictsCount, 1);
  assert.equal(a.staleCount, 1);
  assert.equal(a.listedCount, 5);
  assert.deepEqual(
    a.parts.map((p) => p.id),
    ["p1", "p2", "p3", "p4", "p5"]
  );

  const b = byTemplateId.tB;
  assert.equal(b.length, 3.2);
  assert.equal(b.edgesCount, 1);
  assert.equal(b.facesCount, 0);

  assert.deepEqual(countsByListingId, { L1: 3, L2: 1 });
  assert.deepEqual([...templateIds], ["tA", "tB"]);
  assert.deepEqual([...listingIds], ["L1", "L2"]);
});

test("orphan-only template: listed, nothing counted", () => {
  const { byTemplateId, countsByListingId } = aggregatePaintedPartsByTemplate([
    part("p1", { surface: 4, isCounted: false, isOrphan: true }),
  ]);
  assert.equal(byTemplateId.tA.listedCount, 1);
  assert.equal(byTemplateId.tA.partsCount, 0);
  assert.equal(byTemplateId.tA.surface, 0);
  assert.deepEqual(countsByListingId, {});
});

test("empty / missing input", () => {
  const empty = aggregatePaintedPartsByTemplate(null);
  assert.deepEqual(empty.byTemplateId, {});
  assert.equal(empty.templateIds.size, 0);
});
