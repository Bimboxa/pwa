import assert from "node:assert/strict";
import { test } from "node:test";

import extendCutLine from "./extendCutLine.js";
import findFacePlanesAt, {
  findFaceNormalAlong,
  findFaceNormalAt,
} from "./findFacePlanesAt.js";
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

// User case 2026-11-12: the end of a line drawn down a wall sits on the
// corner wall / slab; the nearest face is the slab, the face the line lies
// on is the wall.
test("findFaceNormalAlong: at the foot of a sheet, a vertical line gets the sheet, a line on the slab gets the slab", () => {
  const scene = [...slab({ size: 5 }), ...sheet()];
  const foot = P(2, 4.998, 0);
  assert.ok(Math.abs(findFaceNormalAt(scene, foot).normal.z) > 0.999);
  const down = findFaceNormalAlong(scene, foot, P(0, 0, -1));
  assert.ok(Math.abs(down.normal.y) > 0.999);
  const flat = findFaceNormalAlong(scene, foot, P(0, 1, 0));
  assert.ok(Math.abs(flat.normal.z) > 0.999);
  assert.equal(findFaceNormalAlong(scene, P(2, 1, 1), P(0, 0, -1)), null);
});

test("findFaceNormalAt: an end a few µm past the edge of a face still finds it, 1 cm past does not", () => {
  assert.ok(findFaceNormalAt(sheet(), P(2, 5, 3.000004)));
  assert.equal(findFaceNormalAt(sheet(), P(2, 5, 3.01)), null);
});
