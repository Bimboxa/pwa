import assert from "node:assert/strict";
import { test } from "node:test";

import getMesh3dLabelAnchor, { LABEL_LIFT_M } from "./getMesh3dLabelAnchor.js";
import getMesh3dLabelTargetPosition, {
  getMesh3dSurfacePoint,
} from "./getMesh3dLabelTargetPosition.js";
import { getClosestSurfacePoint } from "./getShellSurfacePoint.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

// Vertical wall in the z = 0 plane: 4 m wide (x), 2 m high (y), with a
// 1 m x 1 m hole in its middle.
const wall = {
  faces: [
    {
      normal: { x: 0, y: 0, z: 1 },
      contour: [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 4, y: 2, z: 0 },
        { x: 0, y: 2, z: 0 },
      ],
      holes: [
        [
          { x: 1.5, y: 0.5, z: 0 },
          { x: 2.5, y: 0.5, z: 0 },
          { x: 2.5, y: 1.5, z: 0 },
          { x: 1.5, y: 1.5, z: 0 },
        ],
      ],
    },
  ],
};

// Half cylinder of radius 2 around the y axis (x >= 0 side), 1 m high,
// outward winding.
function halfCylinder(segments = 16) {
  const positions = [];
  const at = (i, y) => {
    const a = -Math.PI / 2 + (Math.PI * i) / segments;
    return [2 * Math.cos(a), y, 2 * Math.sin(a)];
  };
  for (let i = 0; i < segments; i++) {
    const a0 = at(i, 0);
    const a1 = at(i + 1, 0);
    const b0 = at(i, 1);
    const b1 = at(i + 1, 1);
    positions.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  return { shell: { positions } };
}

test("closest surface point reports the triangle normal", () => {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const above = getClosestSurfacePoint(positions, { x: 0.2, y: 0.2, z: 3 });
  near(above.point.z, 0);
  near(above.point.x, 0.2);
  near(above.normal.z, 1);
  const outside = getClosestSurfacePoint(positions, { x: 5, y: -1, z: 0 });
  near(outside.point.x, 1);
  near(outside.point.y, 0);
  // Degenerate triangles are skipped.
  assert.equal(
    getClosestSurfacePoint([0, 0, 0, 1, 0, 0, 2, 0, 0], { x: 0, y: 1, z: 0 }),
    null
  );
});

test("planar maille: a point over the material is projected on the face", () => {
  const hit = getMesh3dSurfacePoint(wall, { x: 0.5, y: 1, z: 0.7 });
  near(hit.point.x, 0.5);
  near(hit.point.y, 1);
  near(hit.point.z, 0);
});

test("planar maille: a point outside slides on the border", () => {
  const hit = getMesh3dSurfacePoint(wall, { x: 6, y: 1, z: 0 });
  near(hit.point.x, 4);
  near(hit.point.y, 1);
});

test("planar maille: a point over a hole goes to the hole edge", () => {
  const hit = getMesh3dSurfacePoint(wall, { x: 1.6, y: 1, z: 0 });
  near(hit.point.x, 1.5);
  near(hit.point.y, 1);
});

test("target left untouched sits on the anchor", () => {
  const anchor = getMesh3dLabelAnchor(wall);
  assert.deepEqual(getMesh3dLabelTargetPosition(wall, anchor), anchor.base);
});

test("legacy in-plane offset off the maille is re-attached", () => {
  const anchor = getMesh3dLabelAnchor(wall);
  const position = getMesh3dLabelTargetPosition(
    { ...wall, labelTargetOffset: { u: 50, v: 0 } },
    anchor
  );
  assert.ok(position.x >= -1e-6 && position.x <= 4 + 1e-6);
  near(Math.abs(position.z), LABEL_LIFT_M);
});

test("curved shell: the target stays on the surface", () => {
  const mesh3d = halfCylinder();
  const anchor = getMesh3dLabelAnchor(mesh3d);

  // Legacy offset in the average-normal plane: far off the cylinder.
  const legacy = getMesh3dLabelTargetPosition(
    { ...mesh3d, labelTargetOffset: { u: 1.5, v: 0.2 } },
    anchor
  );
  near(Math.hypot(legacy.x, legacy.z), 2 + LABEL_LIFT_M, 0.03);

  // Persisted surface point: kept, lifted along the local normal.
  const a = Math.PI / 3;
  const stored = { x: 2 * Math.cos(a), y: 0.5, z: 2 * Math.sin(a) };
  const position = getMesh3dLabelTargetPosition(
    { ...mesh3d, labelTargetPoint: stored, labelTargetOffset: { u: 9, v: 9 } },
    anchor
  );
  near(position.y, 0.5, 1e-3);
  near(Math.atan2(position.z, position.x), a, 0.02);
  near(Math.hypot(position.x, position.z), 2 + LABEL_LIFT_M, 0.03);
});
