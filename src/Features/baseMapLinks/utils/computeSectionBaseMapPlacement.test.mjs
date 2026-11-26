import assert from "node:assert/strict";
import test from "node:test";
import computeSectionBaseMapPlacement from "./computeSectionBaseMapPlacement.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

// Mark along world +X at altitude 2: front normal (sin a, 0, cos a) = +Z,
// viewing direction = -Z.
const base = {
  A: { x: 0, y: 2, z: 0 },
  B: { x: 4, y: 2, z: 0 },
  size: { width: 1000, height: 500 },
  meterByPx: 0.01,
};

test("no normal offset: the page is centred on the mark", () => {
  const placement = computeSectionBaseMapPlacement(base);
  near(placement.angleDeg, 0);
  assert.deepEqual(placement.position, { x: 2, y: 2, z: 0 });
  near(placement.viewDir.x, 0);
  near(placement.viewDir.z, -1);
  assert.deepEqual(placement.anchors, { A: base.A, B: base.B });
});

test("the view direction is the opposite of the page front normal", () => {
  const placement = computeSectionBaseMapPlacement({
    ...base,
    B: { x: 3, y: 2, z: -2 },
  });
  const a = (placement.angleDeg * Math.PI) / 180;
  near(placement.viewDir.x, -Math.sin(a));
  near(placement.viewDir.z, -Math.cos(a));
});

test("a normal offset shifts the mark and the page, not the clone", () => {
  const reference = computeSectionBaseMapPlacement({
    ...base,
    alongM: 0.5,
    upM: 1,
  });
  const shifted = computeSectionBaseMapPlacement({
    ...base,
    alongM: 0.5,
    upM: 1,
    normalM: 0.3,
  });
  near(shifted.position.x, reference.position.x);
  near(shifted.position.y, reference.position.y);
  near(shifted.position.z, reference.position.z - 0.3);
  near(shifted.anchors.A.z, -0.3);
  near(shifted.anchors.B.z, -0.3);
  near(shifted.anchors.B.x, 4);
  near(shifted.angleDeg, reference.angleDeg);
  assert.deepEqual(shifted.cloneNorm, reference.cloneNorm);
});
