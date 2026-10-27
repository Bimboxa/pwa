import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import getPerpendicularFoot from "./getPerpendicularFoot.js";

test("the foot lies on the plane, straight along the normal from the point", () => {
  const planePoint = new Vector3(1, 0.5, 2);
  const normal = new Vector3(1, 0, 1).normalize();
  const point = new Vector3(4, 1.7, 0.5);
  const foot = getPerpendicularFoot(point, planePoint, normal);
  assert.ok(Math.abs(foot.clone().sub(planePoint).dot(normal)) < 1e-12);
  const along = point.clone().sub(foot);
  assert.ok(along.clone().cross(normal).length() < 1e-12);
  // Wall-to-wall: the measure is the distance between the two planes.
  assert.ok(
    Math.abs(
      along.length() - Math.abs(point.clone().sub(planePoint).dot(normal))
    ) < 1e-12
  );
});
