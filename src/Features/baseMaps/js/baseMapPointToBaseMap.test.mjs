// Run with: npx vite-node src/Features/baseMaps/js/baseMapPointToBaseMap.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import baseMapPointToBaseMap from "./baseMapPointToBaseMap.js";

const EPS = 1e-9;

const baseMap = (props) => ({
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  meterByPx: 0.01,
  image: { imageSize: { width: 1000, height: 800 } },
  ...props,
});

const near = (a, b, msg) =>
  assert.ok(Math.abs(a - b) < EPS, `${msg}: ${a} vs ${b}`);

test("same base map: identity, altitude becomes the offset", () => {
  const bm = baseMap();
  const p = baseMapPointToBaseMap({ x: 0.3, y: 0.7 }, bm, bm, {
    altitude: 2.5,
  });
  near(p.x, 0.3, "x");
  near(p.y, 0.7, "y");
  near(p.offset, 2.5, "offset");
});

test("two parallel plans: level difference, scale and shift", () => {
  const source = baseMap({ position: { x: 0, y: 3, z: 0 } });
  // Target twice as fine, shifted by 1 m along world X, 2 m lower.
  const target = baseMap({
    meterByPx: 0.005,
    position: { x: 1, y: 1, z: 0 },
    image: { imageSize: { width: 2000, height: 1600 } },
  });
  // Source center lifted by 0.5 m.
  const p = baseMapPointToBaseMap({ x: 0.5, y: 0.5 }, source, target, {
    altitude: 0.5,
  });
  // Source center is world (0, 3.5, 0); target center is world (1, 1, 0):
  // 1 m to the left of the target center = 200 target px = 0.1 of 2000.
  near(p.x, 0.5 - 0.1, "x");
  near(p.y, 0.5, "y");
  near(p.offset, 3.5 - 1, "offset");
});

test("vertical elevation -> horizontal plan: the drawn height is the offset", () => {
  // Wall standing at z = 0 facing +Z, 4 m wide (400 px), 3.2 m high (320 px),
  // its base line at world y = 0 (plane center at y = 1.6).
  const source = baseMap({
    orientation: "VERTICAL",
    position: { x: 0, y: 1.6, z: 0 },
    image: { imageSize: { width: 400, height: 320 } },
  });
  const target = baseMap();
  // A point 1 m right of the wall center, 1 m above the ground
  // (px 300 from the left, py 220 from the top).
  const p = baseMapPointToBaseMap({ x: 0.75, y: 220 / 320 }, source, target);
  near(p.offset, 1, "offset = height above the plan");
  // Plan trace: world x = 1 → 100 px right of the target center (0.6);
  // world z = 0 → target center row (0.5).
  near(p.x, 0.6, "x");
  near(p.y, 0.5, "y");
});

test("missing scale: null", () => {
  const p = baseMapPointToBaseMap(
    { x: 0.5, y: 0.5 },
    baseMap({ meterByPx: null }),
    baseMap({ position: { x: 1, y: 0, z: 0 } })
  );
  assert.equal(p, null);
});
