import assert from "node:assert/strict";
import { test } from "node:test";

import locateFaceNearHit from "./locateFaceNearHit.js";

const v = (x, y, z) => ({ x, y, z });

// Thick wall [0,4]×[0,0.2]×[0,2.5] as a LOCAL mesh (faces wound outward),
// the front parement pierced by a window.
function makeWall() {
  return {
    vertices: [
      v(0, 0, 0),
      v(4, 0, 0),
      v(4, 0.2, 0),
      v(0, 0.2, 0),
      v(0, 0, 2.5),
      v(4, 0, 2.5),
      v(4, 0.2, 2.5),
      v(0, 0.2, 2.5),
      // window on the front (y = 0)
      v(1, 0, 1),
      v(2, 0, 1),
      v(2, 0, 2),
      v(1, 0, 2),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] }, // 0 bottom
      { loop: [4, 5, 6, 7], holes: [] }, // 1 top
      { loop: [0, 1, 5, 4], holes: [[8, 11, 10, 9]] }, // 2 front (-y)
      { loop: [1, 2, 6, 5], holes: [] }, // 3 right
      { loop: [2, 3, 7, 6], holes: [] }, // 4 back (+y)
      { loop: [3, 0, 4, 7], holes: [] }, // 5 left
    ],
  };
}

test("locateFaceNearHit: hit on the shrunk display finds the un-shrunk face", () => {
  const mesh = makeWall();
  // Front parement displayed 10 mm inward; the hit normal is flipped toward
  // the camera (either sign is fine).
  assert.equal(locateFaceNearHit(mesh, v(3, 0.01, 1.2), v(0, -1, 0)), 2);
  assert.equal(locateFaceNearHit(mesh, v(3, 0.01, 1.2), v(0, 1, 0)), 2);
  // Back parement, top lowered by 5 mm.
  assert.equal(locateFaceNearHit(mesh, v(3, 0.19, 1.2), v(0, 1, 0)), 4);
  assert.equal(locateFaceNearHit(mesh, v(3, 0.1, 2.495), v(0, 0, 1)), 1);
});

test("locateFaceNearHit: the normal settles hits near an edge", () => {
  const mesh = makeWall();
  // 3 mm under the top edge, on the shrunk front: the top plane is nearer
  // (8 mm) than the front one (10 mm)...
  const hit = v(3, 0.01, 2.492);
  assert.equal(locateFaceNearHit(mesh, hit, null), 1);
  // ...the hit normal picks the front.
  assert.equal(locateFaceNearHit(mesh, hit, v(0, -1, 0)), 2);
  // A normal 1° off still matches, 5° off does not.
  const tilt = (deg) =>
    v(0, -Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
  assert.equal(locateFaceNearHit(mesh, hit, tilt(1)), 2);
  assert.equal(locateFaceNearHit(mesh, hit, tilt(5)), -1);
});

test("locateFaceNearHit: holes, slack, distance limits", () => {
  const mesh = makeWall();
  // Inside the window, far from its frame: not the front face.
  assert.equal(locateFaceNearHit(mesh, v(1.5, 0.005, 1.5), v(0, -1, 0)), -1);
  // Inside the window, 1 cm from the frame: within the slack.
  assert.equal(locateFaceNearHit(mesh, v(1.5, 0.005, 1.01), v(0, -1, 0)), 2);
  // 3 cm off the plane: too far (default 2 cm), fine with a wider limit.
  assert.equal(locateFaceNearHit(mesh, v(3, -0.03, 1.2), v(0, -1, 0)), -1);
  assert.equal(locateFaceNearHit(mesh, v(3, -0.03, 1.2), v(0, -1, 0), 0.05), 2);
  // Beyond the face's contour + slack.
  assert.equal(locateFaceNearHit(mesh, v(4.05, 0, 1.2), v(0, -1, 0)), -1);
});

test("locateFaceNearHit: empty input", () => {
  assert.equal(locateFaceNearHit(null, v(0, 0, 0)), -1);
  assert.equal(locateFaceNearHit({ vertices: [], faces: [] }, v(0, 0, 0)), -1);
  assert.equal(locateFaceNearHit(makeWall(), null), -1);
});

test("locateFaceNearHit: the view ray keeps a thin band's top on top", () => {
  // 8 mm band, displayed shrunk: its top at 3 mm is nearer the bottom plane.
  const band = makeWall();
  band.vertices = band.vertices.map((p) => v(p.x, p.y, p.z > 0 ? 0.008 : 0));
  band.faces = band.faces.map((face) => ({ ...face, holes: [] }));
  const hit = v(3, 0.1, 0.003);
  assert.equal(locateFaceNearHit(band, hit, v(0, 0, 1)), 0);
  assert.equal(
    locateFaceNearHit(band, hit, v(0, 0, 1), 0.02, { rayDir: v(0, 0, -1) }),
    1
  );
  // Seen from below, the bottom wins.
  assert.equal(
    locateFaceNearHit(band, hit, v(0, 0, 1), 0.02, { rayDir: v(0, 0, 1) }),
    0
  );
});
