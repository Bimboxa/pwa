import assert from "node:assert/strict";
import { test } from "node:test";

import sectionTrianglesByPlane from "./sectionTrianglesByPlane.js";
import { P, box, near, nearPoint, slab, tri } from "./cutLineFixtures.mjs";

const PLANE_X2 = { normal: P(1, 0, 0), constant: 2 };

test("vertical plane x = 2 through the 2-triangle slab: two segments along x = 2, one per triangle", () => {
  const segments = sectionTrianglesByPlane(PLANE_X2, slab());
  assert.equal(segments.length, 2);
  for (const s of segments) {
    near(s.a.x, 2);
    near(s.b.x, 2);
    near(s.a.z, 0);
    near(s.b.z, 0);
    nearPoint(s.normal, P(0, 0, 1));
  }
  assert.deepEqual(
    segments.map((s) => s.triIndex),
    [0, 1]
  );
  const ys = segments.flatMap((s) => [s.a.y, s.b.y]).sort((p, q) => p - q);
  near(ys[0], 0);
  near(ys[ys.length - 1], 10);
});

test("closed box: the section is a closed rectangle outline, normals carried per triangle", () => {
  const segments = sectionTrianglesByPlane(
    PLANE_X2,
    box({ min: P(0, 5, 0), max: P(10, 5.2, 3) })
  );
  // Bottom, top, front and back faces are each cut in 2 (their diagonal
  // crosses x = 2); the x = 0 / x = 10 end faces are not crossed.
  assert.equal(segments.length, 8);
  for (const s of segments) {
    near(s.a.x, 2);
    near(s.b.x, 2);
    assert.ok(Math.abs(s.normal.x) < 1e-9, "end faces are not crossed");
  }
});

test("coplanar triangles and mere touches are ignored", () => {
  const coplanar = { normal: P(0, 0, 1), constant: 0 };
  assert.equal(sectionTrianglesByPlane(coplanar, slab()).length, 0);

  // A triangle touching the plane at one vertex only.
  const touching = tri(P(2, 0, 0), P(3, 0, 0), P(3, 1, 0));
  assert.equal(sectionTrianglesByPlane(PLANE_X2, [touching]).length, 0);

  // A vertex ON the plane with the other two straddling still yields one
  // segment (EPS tolerance keeps the contour closed).
  const grazing = tri(P(2, 0, 0), P(3, 2, 0), P(1, 2, 0));
  const segs = sectionTrianglesByPlane(PLANE_X2, [grazing]);
  assert.equal(segs.length, 1);
  nearPoint(segs[0].a, P(2, 0, 0));
  nearPoint(segs[0].b, P(2, 2, 0));
});

test("empty / invalid input: no segments", () => {
  assert.deepEqual(sectionTrianglesByPlane(null, slab()), []);
  assert.deepEqual(sectionTrianglesByPlane(PLANE_X2, []), []);
  assert.deepEqual(sectionTrianglesByPlane(PLANE_X2, null), []);
});
