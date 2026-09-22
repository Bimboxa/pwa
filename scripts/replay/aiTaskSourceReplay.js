// Run: node scripts/replay/aiTaskSourceReplay.js
import assert from "node:assert/strict";
import {
  describeAiTaskSource,
  assertAiTaskTarget,
} from "../../src/Features/aiTasks/utils/aiTaskSource.js";

const baseMap = {
  id: "map",
  name: "Plan",
  image: { fileName: "original", imageSize: { width: 600, height: 400 } },
  createdFrom: {
    type: "PDF_PAGE",
    resourceId: "pdf",
    versionId: "source",
    pageNumber: 2,
    rotation: 90,
  },
  versions: [
    {
      id: "source",
      image: { fileName: "original", imageSize: { width: 600, height: 400 } },
      transform: { x: 20, y: 30, scale: 0.5, rotation: 90 },
    },
    {
      id: "enhanced",
      isActive: true,
      image: { fileName: "enhanced", imageSize: { width: 1200, height: 800 } },
      transform: { x: 500, y: 0, scale: 1, rotation: 0 },
    },
  ],
  getImageSize: () => ({ width: 1000, height: 800 }),
};
const source = describeAiTaskSource(baseMap);
assert.equal(source.frame.pageNumber, 2);
assert.equal(source.sourceImageSize.width, 600);
assert.equal(
  source.transform.x,
  20,
  "use PDF version placement, not enhanced image placement"
);
const payload = {
  image: { width: 1000, height: 800 },
  aiTaskTarget: {
    frame: source.frame,
    sourceImageSize: source.sourceImageSize,
    transform: source.transform,
  },
};
assert.doesNotThrow(() => assertAiTaskTarget(baseMap, payload));
assert.throws(() =>
  assertAiTaskTarget(
    { ...baseMap, createdFrom: { ...baseMap.createdFrom, rotation: 180 } },
    payload
  )
);
assert.throws(() =>
  assertAiTaskTarget(
    { ...baseMap, getImageSize: () => ({ width: 2000, height: 800 }) },
    payload
  )
);
assert.throws(() =>
  describeAiTaskSource({
    ...baseMap,
    createdFrom: { ...baseMap.createdFrom, versionId: "deleted" },
  })
);
assert.throws(() => describeAiTaskSource({ ...baseMap, createdFrom: null }));
assert.throws(() => describeAiTaskSource(null));
console.log(
  "AI task source replay passed: provenance, source version, and stale-frame rejection."
);
