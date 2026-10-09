import assert from "node:assert/strict";
import { test } from "node:test";

import { faceArea } from "./meshPaintGeometry.js";
import { near, v } from "./meshPaintTestFixtures.mjs";
import triangulatePaintFace from "./triangulatePaintFace.js";

// Signed area of every triangle along n (> 0: CCW about n).
function triangleAreasAlong(positions, n) {
  const areas = [];
  for (let i = 0; i < positions.length; i += 9) {
    const a = v(positions[i], positions[i + 1], positions[i + 2]);
    const b = v(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = v(positions[i + 6], positions[i + 7], positions[i + 8]);
    const e1 = v(b.x - a.x, b.y - a.y, b.z - a.z);
    const e2 = v(c.x - a.x, c.y - a.y, c.z - a.z);
    const cr = v(
      e1.y * e2.z - e1.z * e2.y,
      e1.z * e2.x - e1.x * e2.z,
      e1.x * e2.y - e1.y * e2.x
    );
    areas.push((cr.x * n.x + cr.y * n.y + cr.z * n.z) / 2);
  }
  return areas;
}

test("triangulatePaintFace: wall front with a window, front faces toward -y", () => {
  const n = v(0, -1, 0);
  const face = {
    polygons: [
      {
        contour: [v(0, 0, 0), v(5, 0, 0), v(5, 0, 2.5), v(0, 0, 2.5)],
        holes: [[v(1, 0, 1), v(1, 0, 2), v(2, 0, 2), v(2, 0, 1)]],
      },
    ],
    normal: n,
  };
  const { positions, normals } = triangulatePaintFace(face, { lift: 0.001 });
  assert.equal(positions.length % 9, 0);
  assert.equal(normals.length, positions.length);
  const areas = triangleAreasAlong(positions, n);
  assert.ok(
    areas.every((a) => a > 0),
    "every triangle CCW about the normal"
  );
  near(
    areas.reduce((s, a) => s + a, 0),
    faceArea(face),
    1e-5
  );
  // Lifted 1 mm toward the painted side (-y).
  for (let i = 1; i < positions.length; i += 3)
    near(positions[i], -0.001, 1e-7);
  for (let i = 0; i < normals.length; i += 3) {
    assert.deepEqual([normals[i], normals[i + 1], normals[i + 2]], [0, -1, 0]);
  }
});

test("triangulatePaintFace: wrong input winding and multi-polygon", () => {
  const n = v(0, 0, -1); // slab bottom, painted from below
  const face = {
    polygons: [
      // CCW about +z (wrong for a -z face) on purpose
      { contour: [v(0, 0, 3), v(2, 0, 3), v(2, 1, 3), v(0, 1, 3)], holes: [] },
      { contour: [v(4, 0, 3), v(4, 1, 3), v(5, 1, 3), v(5, 0, 3)], holes: [] },
    ],
    normal: n,
  };
  const { positions } = triangulatePaintFace(face);
  const areas = triangleAreasAlong(positions, n);
  assert.equal(areas.length, 4);
  assert.ok(areas.every((a) => a > 0));
  near(
    areas.reduce((s, a) => s + a, 0),
    3,
    1e-6
  );
});

test("triangulatePaintFace: concave L and degenerate input", () => {
  const n = v(0, 0, 1);
  const face = {
    polygons: [
      {
        contour: [
          v(0, 0, 0),
          v(2, 0, 0),
          v(2, 1, 0),
          v(1, 1, 0),
          v(1, 1, 0), // duplicate vertex
          v(1, 2, 0),
          v(0, 2, 0),
          v(0, 0, 0), // closing duplicate
        ],
        holes: [],
      },
    ],
    normal: n,
  };
  const areas = triangleAreasAlong(triangulatePaintFace(face).positions, n);
  assert.ok(areas.every((a) => a > 0));
  near(
    areas.reduce((s, a) => s + a, 0),
    3,
    1e-6
  );
  assert.equal(triangulatePaintFace({ polygons: [] }).positions.length, 0);
  assert.equal(triangulatePaintFace(null).positions.length, 0);
});

test("triangulatePaintFace: flip winds and lifts toward the other side", () => {
  const n = v(0, -1, 0);
  const face = {
    polygons: [
      {
        contour: [v(0, 0, 0), v(5, 0, 0), v(5, 0, 2.5), v(0, 0, 2.5)],
        holes: [],
      },
    ],
    normal: n,
  };
  const { positions, normals } = triangulatePaintFace(face, {
    lift: 0.0005,
    flip: true,
  });
  const areas = triangleAreasAlong(positions, n);
  assert.ok(
    areas.every((a) => a < 0),
    "every triangle CW about the painted normal (CCW about -n)"
  );
  near(
    areas.reduce((s, a) => s - a, 0),
    faceArea(face),
    1e-5
  );
  // Lifted 0.5 mm away from the painted side (+y).
  for (let i = 1; i < positions.length; i += 3)
    near(positions[i], 0.0005, 1e-7);
  for (let i = 0; i < normals.length; i += 3) {
    near(normals[i], 0, 1e-9);
    near(normals[i + 1], 1, 1e-9);
    near(normals[i + 2], 0, 1e-9);
  }
});
