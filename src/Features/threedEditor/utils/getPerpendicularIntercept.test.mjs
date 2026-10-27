import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import getIntercept from "./getPerpendicularIntercept.js";

const close = (a, b) => assert.ok(a.distanceTo(b) < 1e-9, `${a.toArray()}`);

test("from the first point along its normal to the facing plane", () => {
  // Wall x = 0 (normal +X), facing wall x = 3.2 seen at (3.2, 1.7, 5).
  const start = new Vector3(0, 1.1, 0.4);
  const { end, planeNormal } = getIntercept(
    start,
    new Vector3(1, 0, 0),
    new Vector3(3.2, 1.7, 5),
    new Vector3(-1, 0, 0)
  );
  close(end, new Vector3(3.2, 1.1, 0.4));
  close(planeNormal, new Vector3(-1, 0, 0));
  // The normal sign does not matter.
  close(
    getIntercept(
      start,
      new Vector3(-1, 0, 0),
      new Vector3(3.2, 1.7, 5),
      new Vector3(-1, 0, 0)
    ).end,
    end
  );
});

test("a slanted facing plane is intercepted, a parallel one falls back", () => {
  const start = new Vector3(0, 0, 0);
  const n = new Vector3(1, 0, 0);
  const slanted = new Vector3(-1, 0, 1).normalize();
  const point = new Vector3(4, 0, 1);
  const { end } = getIntercept(start, n, point, slanted);
  assert.ok(Math.abs(end.clone().sub(point).dot(slanted)) < 1e-9);
  assert.equal(end.y, 0);
  assert.equal(end.z, 0);
  // Facing plane containing the direction: plane through the point // first.
  const fallback = getIntercept(start, n, point, new Vector3(0, 0, 1));
  close(fallback.end, new Vector3(4, 0, 0));
  close(fallback.planeNormal, n);
  close(getIntercept(start, n, point).end, new Vector3(4, 0, 0));
});
