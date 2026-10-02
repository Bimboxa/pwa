// Run with: npx vite-node src/Features/baseMaps/js/getBaseMapToBaseMapPxMatrix.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import areBaseMapsParallel from "./areBaseMapsParallel.js";
import getBaseMapToBaseMapPxMatrix, {
  applyBaseMapMatrix,
} from "./getBaseMapToBaseMapPxMatrix.js";
import getBaseMapPoseFromOverlayGesture from "./getBaseMapPoseFromOverlayGesture.js";

const EPS = 1e-6;

const baseMap = (props) => ({
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  meterByPx: 0.01,
  image: { imageSize: { width: 1000, height: 800 } },
  ...props,
});

const centerOf = (bm) => ({
  x: bm.image.imageSize.width / 2,
  y: bm.image.imageSize.height / 2,
});

// SVG `rotate(deg cx cy)` then `translate(dx dy)`, applied AFTER m.
function moved(
  m,
  { deltaDeg = 0, pivot = { x: 0, y: 0 }, d = { x: 0, y: 0 } }
) {
  const r = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rot = (p) => ({
    x: pivot.x + (p.x - pivot.x) * cos - (p.y - pivot.y) * sin + d.x,
    y: pivot.y + (p.x - pivot.x) * sin + (p.y - pivot.y) * cos + d.y,
  });
  return (p) => rot(applyBaseMapMatrix(m, p));
}

function assertSameMapping(expected, m, source, message) {
  const { width, height } = source.image.imageSize;
  for (const p of [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width / 3, y: height / 4 },
  ]) {
    const e = expected(p);
    const got = applyBaseMapMatrix(m, p);
    assert.ok(
      Math.abs(e.x - got.x) < EPS && Math.abs(e.y - got.y) < EPS,
      `${message}: ${JSON.stringify(p)} -> ${JSON.stringify(got)}, expected ${JSON.stringify(e)}`
    );
  }
}

test("same pose, same scale: identity", () => {
  const m = getBaseMapToBaseMapPxMatrix(baseMap(), baseMap());
  assertSameMapping((p) => p, m, baseMap(), "identity");
  assert.ok(Math.abs(m.scale - 1) < EPS);
});

test("scale = source meterByPx / host meterByPx, centres aligned", () => {
  const source = baseMap({
    meterByPx: 0.02,
    image: { imageSize: { width: 400, height: 300 } },
  });
  const host = baseMap();
  const m = getBaseMapToBaseMapPxMatrix(source, host);
  assert.ok(Math.abs(m.scale - 2) < EPS);
  const c = applyBaseMapMatrix(m, centerOf(source));
  assert.ok(Math.abs(c.x - 500) < EPS && Math.abs(c.y - 400) < EPS);
});

test("world +X is image right, world +Z is image down; altitude is dropped", () => {
  const source = baseMap({ position: { x: 1, y: 3.2, z: 2 } });
  const m = getBaseMapToBaseMapPxMatrix(source, baseMap());
  // 1 m right, 2 m down at 0.01 m/px
  assertSameMapping(
    (p) => ({ x: p.x + 100, y: p.y + 200 }),
    m,
    source,
    "shift"
  );
});

test("missing meterByPx or size: null", () => {
  assert.equal(
    getBaseMapToBaseMapPxMatrix(baseMap({ meterByPx: null }), baseMap()),
    null
  );
  assert.equal(
    getBaseMapToBaseMapPxMatrix(baseMap(), baseMap({ image: null })),
    null
  );
});

test("parallel = same normal, whatever the altitude", () => {
  const plan = baseMap();
  assert.ok(
    areBaseMapsParallel(plan, baseMap({ position: { x: 0, y: 6, z: 0 } }))
  );
  assert.ok(areBaseMapsParallel(plan, baseMap({ angleDeg: 37 })));
  const section = baseMap({ orientation: "VERTICAL", angleDeg: 30 });
  assert.ok(!areBaseMapsParallel(plan, section));
  assert.ok(
    areBaseMapsParallel(
      section,
      baseMap({ orientation: "VERTICAL", angleDeg: 30 })
    )
  );
  assert.ok(
    !areBaseMapsParallel(
      section,
      baseMap({ orientation: "VERTICAL", angleDeg: 31 })
    )
  );
  // opposite facing = mirrored overlay
  assert.ok(
    !areBaseMapsParallel(
      section,
      baseMap({ orientation: "VERTICAL", angleDeg: 210 })
    )
  );
});

const HOSTS = [
  baseMap(),
  baseMap({
    angleDeg: 25,
    position: { x: -4, y: 0, z: 7 },
    meterByPx: 0.025,
    image: { imageSize: { width: 1400, height: 900 } },
  }),
];
const SOURCE = baseMap({
  angleDeg: -40,
  position: { x: 12, y: 2.8, z: -3 },
  meterByPx: 0.015,
  image: { imageSize: { width: 640, height: 480 } },
});

test("move: the committed pose reproduces the live translate", () => {
  for (const host of HOSTS) {
    const m = getBaseMapToBaseMapPxMatrix(SOURCE, host);
    const d = { x: 137.5, y: -42 };
    const centerPx = applyBaseMapMatrix(m, centerOf(SOURCE));
    const patch = getBaseMapPoseFromOverlayGesture({
      source: SOURCE,
      host,
      centerPx,
      nextCenterPx: { x: centerPx.x + d.x, y: centerPx.y + d.y },
    });
    assert.ok(
      Math.abs(patch.position.y - SOURCE.position.y) < EPS,
      "altitude kept"
    );
    assert.ok(Math.abs(patch.angleDeg - SOURCE.angleDeg) < EPS, "angle kept");
    const next = getBaseMapToBaseMapPxMatrix({ ...SOURCE, ...patch }, host);
    assertSameMapping(moved(m, { d }), next, SOURCE, "move");
  }
});

test("rotate: the committed pose reproduces the live rotate about the centre", () => {
  for (const host of HOSTS) {
    for (const deltaDeg of [15, -70, 200]) {
      const m = getBaseMapToBaseMapPxMatrix(SOURCE, host);
      const centerPx = applyBaseMapMatrix(m, centerOf(SOURCE));
      const patch = getBaseMapPoseFromOverlayGesture({
        source: SOURCE,
        host,
        centerPx,
        nextCenterPx: centerPx,
        deltaDeg,
      });
      assert.ok(patch.angleDeg > -180 - EPS && patch.angleDeg <= 180 + EPS);
      const next = getBaseMapToBaseMapPxMatrix({ ...SOURCE, ...patch }, host);
      assertSameMapping(
        moved(m, { deltaDeg, pivot: centerPx }),
        next,
        SOURCE,
        `rotate ${deltaDeg}`
      );
    }
  }
});

test("vertical: translation inside the plane, the angle never changes", () => {
  const host = baseMap({ orientation: "VERTICAL", angleDeg: 30 });
  const source = baseMap({
    orientation: "VERTICAL",
    angleDeg: 30,
    position: { x: 2, y: 1.5, z: -1 },
    meterByPx: 0.02,
    image: { imageSize: { width: 500, height: 300 } },
  });
  const m = getBaseMapToBaseMapPxMatrix(source, host);
  const d = { x: -80, y: 60 };
  const centerPx = applyBaseMapMatrix(m, centerOf(source));
  const patch = getBaseMapPoseFromOverlayGesture({
    source,
    host,
    centerPx,
    nextCenterPx: { x: centerPx.x + d.x, y: centerPx.y + d.y },
    deltaDeg: 45,
  });
  assert.equal(patch.angleDeg, 30);
  // 60 px down at 0.01 m/px = 0.6 m lower
  assert.ok(Math.abs(patch.position.y - (1.5 - 0.6)) < EPS);
  const next = getBaseMapToBaseMapPxMatrix({ ...source, ...patch }, host);
  assertSameMapping(moved(m, { d }), next, source, "vertical move");
});
