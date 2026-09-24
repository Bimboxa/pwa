// Run from the repo root (bundled like layerStackingReplay — the solver's
// relative imports have no extension):
//   node_modules/.bin/esbuild scripts/replay/baseMapLinkPlacementReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/baseMapLinkPlacementReplay.mjs && node /tmp/baseMapLinkPlacementReplay.mjs
//
// Replays computeVerticalBaseMapPlacementFromLink on synthetic base maps and
// checks the contract: the clone's endpoints, reprojected through the
// returned pose + scale, land on the plan mark's world anchors.
import assert from "node:assert/strict";
import computeVerticalBaseMapPlacementFromLink from "Features/baseMaps/js/computeVerticalBaseMapPlacementFromLink";
import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";

const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

const makePlan = (angleDeg = 0) => ({
  orientation: "HORIZONTAL",
  angleDeg,
  position: { x: 0, y: 3, z: 0 },
  meterByPx: 0.01,
  image: { imageSize: { width: 1000, height: 1000 } },
});
const makeElevation = () => ({
  orientation: "VERTICAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  meterByPx: 0.02, // deliberately wrong: the clone recalibrates it
  image: { imageSize: { width: 800, height: 400 } },
});

const p1 = { x: 0.5, y: 0.5 };
const p2 = { x: 0.7, y: 0.5 };
const q1 = { x: 0.25, y: 0.5 };
const q2 = { x: 0.75, y: 0.5 };

// --- case 1: plan at angle 0 ---

{
  const plan = makePlan(0);
  const elevation = makeElevation();
  const pose = computeVerticalBaseMapPlacementFromLink({
    planBaseMap: plan,
    elevationBaseMap: elevation,
    planNorm: { p1, p2 },
    cloneNorm: { q1, q2 },
  });
  assert.ok(pose, "pose expected");
  near(pose.meterByPx, 2 / 400);
  near(pose.angleDeg, 0);
  near(pose.position.x, 1);
  near(pose.position.y, 3);
  near(pose.position.z, 0);
  console.log("case 1 ok", pose);
}

// --- reprojection contract, several plan angles, both clone orders ---

const check = (angleDeg, cloneOrder) => {
  const plan = makePlan(angleDeg);
  const elevation = makeElevation();
  const [c1, c2] = cloneOrder === "ltr" ? [q1, q2] : [q2, q1];
  const pose = computeVerticalBaseMapPlacementFromLink({
    planBaseMap: plan,
    elevationBaseMap: elevation,
    planNorm: { p1, p2 },
    cloneNorm: { q1: c1, q2: c2 },
  });
  assert.ok(pose, "pose expected");
  const posed = { ...elevation, ...pose };
  const A = baseMapNormalizedToWorld(p1, plan);
  const B = baseMapNormalizedToWorld(p2, plan);
  const wa = baseMapNormalizedToWorld(q1, posed);
  const wb = baseMapNormalizedToWorld(q2, posed);
  for (const k of ["x", "y", "z"]) {
    near(wa[k], A[k], 1e-9);
    near(wb[k], B[k], 1e-9);
  }
  return pose;
};

for (const angle of [0, 37, -120, 200]) {
  const a = check(angle, "ltr");
  const b = check(angle, "rtl");
  near(a.angleDeg, b.angleDeg);
  console.log(`reprojection ok at plan angle ${angle}`);
}

// --- reversed mark: heading flips by 180°, the elevation faces the other way ---

{
  const plan = makePlan(37);
  const elevation = makeElevation();
  const fwd = computeVerticalBaseMapPlacementFromLink({
    planBaseMap: plan,
    elevationBaseMap: elevation,
    planNorm: { p1, p2 },
    cloneNorm: { q1, q2 },
  });
  const rev = computeVerticalBaseMapPlacementFromLink({
    planBaseMap: plan,
    elevationBaseMap: elevation,
    planNorm: { p1: p2, p2: p1 },
    cloneNorm: { q1, q2 },
  });
  const wrap = (d) => ((d % 360) + 360) % 360;
  near(wrap(fwd.angleDeg - rev.angleDeg), 180, 1e-9);
  near(fwd.meterByPx, rev.meterByPx);
  console.log("reverse ok", fwd.angleDeg, rev.angleDeg);
}

// --- guards ---

{
  const plan = makePlan(0);
  const elevation = makeElevation();
  assert.equal(
    computeVerticalBaseMapPlacementFromLink({
      planBaseMap: { ...plan, orientation: "VERTICAL" },
      elevationBaseMap: elevation,
      planNorm: { p1, p2 },
      cloneNorm: { q1, q2 },
    }),
    null
  );
  assert.equal(
    computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: { ...elevation, orientation: "HORIZONTAL" },
      planNorm: { p1, p2 },
      cloneNorm: { q1, q2 },
    }),
    null
  );
  assert.equal(
    computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: elevation,
      planNorm: { p1, p2: p1 },
      cloneNorm: { q1, q2 },
    }),
    null
  );
  assert.equal(
    computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: elevation,
      planNorm: { p1, p2 },
      cloneNorm: { q1, q2: { x: q1.x, y: 0.9 } },
    }),
    null
  );
  console.log("guards ok");
}

console.log("baseMapLinkPlacementReplay: all checks passed");
