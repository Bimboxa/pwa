import assert from "node:assert/strict";
import { test } from "node:test";

import extendCutLine from "./extendCutLine.js";
import findFacePlanesAt, { findFaceNormalAt } from "./findFacePlanesAt.js";
import { P, nearPoints, sheet, slab, wall } from "./cutLineFixtures.mjs";

test("findFacePlanesAt: one plane on a slab, two at the foot of a wall, none in the air", () => {
  const scene = [...slab(), ...wall()];
  assert.equal(findFacePlanesAt(scene, P(2, 1, 0)).length, 1);
  assert.equal(findFacePlanesAt(scene, P(2, 5, 0)).length, 2);
  assert.equal(findFacePlanesAt(scene, P(2, 1, 1)).length, 0);
  assert.equal(findFaceNormalAt(scene, P(2, 1, 1)), null);
});

test("findFaceNormalAt: a point 3 mm off a face still finds it, 1 cm off does not", () => {
  assert.ok(findFaceNormalAt(sheet(), P(2, 4.997, 1)));
  assert.equal(findFaceNormalAt(sheet(), P(2, 4.99, 1)), null);
});

// User case 2026-11-12: a cut line drawn on the plan (not in the soup) up to
// the foot of a wall sheet, the click landing on the plan — no face under
// the cursor. The face read from the soup makes the end climb the sheet.
test("end at the foot of a sheet without a cursor face: the soup face extends it to the top", () => {
  const drawn = [P(2, 1, 0), P(2, 5, 0)];
  const triangles = sheet();
  const endFace = findFaceNormalAt(triangles, drawn[1]);
  assert.ok(endFace);
  assert.ok(Math.abs(endFace.normal.y) > 0.999);
  const r = extendCutLine({
    drawn,
    startFace: findFaceNormalAt(triangles, drawn[0]),
    endFace,
    triangles,
    upNormal: P(0, 0, 1),
  });
  nearPoints(r.points, [P(2, 1, 0), P(2, 5, 0), P(2, 5, 3)]);
  assert.equal(r.derivedStart, 0);
  assert.equal(r.derivedEnd, 1);
});
