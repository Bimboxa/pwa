import assert from "node:assert/strict";
import test from "node:test";

import buildVectorizedSectionRows from "./buildVectorizedSectionRows.js";

test("normalized points, shared joints, closed loops", () => {
  let next = 0;
  const { newPoints, newAnnotations } = buildVectorizedSectionRows({
    polylines: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1, joint: 0 },
        ],
        closed: false,
      },
      {
        points: [
          { x: 2, y: 1, joint: 0 },
          { x: 4, y: 2 },
        ],
        closed: false,
      },
      {
        points: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
          { x: 2, y: 2 },
        ],
        closed: true,
      },
      { points: [{ x: 1, y: 1 }], closed: false }, // degenerate: skipped
    ],
    widthM: 4,
    heightM: 2,
    baseMapId: "bm",
    projectId: "p",
    scopeId: "s",
    annotationProps: { strokeColor: "#000", strokeWidth: 2 },
    createId: () => `id${next++}`,
    now: "now",
  });

  assert.equal(newAnnotations.length, 3);
  // 2 + 1 (joint shared) + 3
  assert.equal(newPoints.length, 6);
  assert.equal(newAnnotations[0].points[1].id, newAnnotations[1].points[0].id);
  const shared = newPoints.find((p) => p.id === newAnnotations[0].points[1].id);
  assert.deepEqual(
    { x: shared.x, y: shared.y, baseMapId: shared.baseMapId },
    { x: 0.5, y: 0.5, baseMapId: "bm" }
  );
  newPoints.forEach((p) => assert.equal(p.listingId, undefined));

  const [open, , loop] = newAnnotations;
  assert.equal(open.type, "POLYLINE");
  assert.equal(open.isTemplateless, true);
  assert.equal(open.listingId, null);
  assert.equal(open.scopeId, "s");
  assert.equal(open.strokeWidth, 2);
  assert.equal(open.closeLine, undefined);
  assert.equal(loop.closeLine, true);
  // references only: never inline coordinates
  open.points.forEach((ref) => assert.deepEqual(Object.keys(ref), ["id"]));
});
