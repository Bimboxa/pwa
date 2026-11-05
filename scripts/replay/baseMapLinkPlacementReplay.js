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
import {
  computeKeepScaleClonePoints,
  getBaseMapLinkWorldLength,
} from "Features/baseMaps/js/computeBaseMapLinkCloneGeometry";
import getNextBaseMapLinkLabel from "Features/baseMapLinks/utils/getNextBaseMapLinkLabel";

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

// --- keep scale ("Adapter l'échelle" off): anchor + direction only ---

{
  const W = 800;
  const H = 400;
  const toNorm = (px) => ({ x: px.x / W, y: px.y / H });

  const solveKeep = (plan, elevation, anchorPx, directionPx, marks = { p1, p2 }) => {
    const lengthM = getBaseMapLinkWorldLength({
      planBaseMap: plan,
      planNorm: marks,
    });
    const pts = computeKeepScaleClonePoints({
      anchorPx,
      directionPx,
      lengthM,
      meterByPx: elevation.meterByPx,
    });
    assert.ok(pts, "keep-scale points expected");
    const pose = computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: elevation,
      planNorm: marks,
      cloneNorm: { q1: toNorm(pts.anchorPx), q2: toNorm(pts.farPx) },
      keepScale: true,
    });
    assert.ok(pose, "keep-scale pose expected");
    return { pts, pose, lengthM };
  };

  for (const angle of [0, 37, -120, 200]) {
    const plan = makePlan(angle);
    const elevation = makeElevation();
    const A = baseMapNormalizedToWorld(p1, plan);
    const B = baseMapNormalizedToWorld(p2, plan);

    // second click on the RIGHT: the anchor pins p1, the far point lands on p2
    const anchor = { x: 300, y: 180 };
    const toRight = solveKeep(plan, elevation, anchor, { x: 520, y: 90 });
    assert.equal(toRight.pts.side, 1);
    near(toRight.pose.meterByPx, elevation.meterByPx);
    near(toRight.pts.farPx.y, anchor.y);
    near(toRight.pts.farPx.x - anchor.x, toRight.lengthM / elevation.meterByPx);
    const posedRight = { ...elevation, ...toRight.pose };
    const wAnchor = baseMapNormalizedToWorld(toNorm(toRight.pts.anchorPx), posedRight);
    const wFar = baseMapNormalizedToWorld(toNorm(toRight.pts.farPx), posedRight);
    for (const k of ["x", "y", "z"]) {
      near(wAnchor[k], A[k], 1e-9);
      near(wFar[k], B[k], 1e-9);
    }

    // second click on the LEFT: the anchor pins p2, the far point lands on p1
    const toLeft = solveKeep(plan, elevation, anchor, { x: 120, y: 260 });
    assert.equal(toLeft.pts.side, -1);
    near(toLeft.pose.meterByPx, elevation.meterByPx);
    const posedLeft = { ...elevation, ...toLeft.pose };
    const wAnchorL = baseMapNormalizedToWorld(toNorm(toLeft.pts.anchorPx), posedLeft);
    const wFarL = baseMapNormalizedToWorld(toNorm(toLeft.pts.farPx), posedLeft);
    for (const k of ["x", "y", "z"]) {
      near(wAnchorL[k], B[k], 1e-9);
      near(wFarL[k], A[k], 1e-9);
    }

    // same heading as the "adapt" solve: the observer side is untouched
    const adapt = computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: elevation,
      planNorm: { p1, p2 },
      cloneNorm: { q1, q2 },
    });
    near(toRight.pose.angleDeg, adapt.angleDeg);
    near(toLeft.pose.angleDeg, adapt.angleDeg);

    // idempotence: re-canonicalising from the stored points changes nothing
    const again = computeKeepScaleClonePoints({
      anchorPx: toLeft.pts.anchorPx,
      directionPx: toLeft.pts.farPx,
      lengthM: toLeft.lengthM,
      meterByPx: toLeft.pose.meterByPx,
    });
    near(again.farPx.x, toLeft.pts.farPx.x);
    near(again.farPx.y, toLeft.pts.farPx.y);

    // the solver ignores a stale far point: only the anchor and the side count
    const stale = computeVerticalBaseMapPlacementFromLink({
      planBaseMap: plan,
      elevationBaseMap: elevation,
      planNorm: { p1, p2 },
      cloneNorm: {
        q1: toNorm(anchor),
        q2: toNorm({ x: anchor.x + 3, y: anchor.y + 50 }),
      },
      keepScale: true,
    });
    for (const k of ["x", "y", "z"]) {
      near(stale.position[k], toRight.pose.position[k]);
    }

    // lengthened source mark: the anchor stays, the far point follows
    const longer = { p1, p2: { x: 0.9, y: 0.5 } };
    const stretched = solveKeep(plan, elevation, anchor, { x: 520, y: 90 }, longer);
    near(stretched.pts.anchorPx.x, anchor.x);
    near(stretched.lengthM, 2 * toRight.lengthM);
    near(
      stretched.pts.farPx.x - anchor.x,
      2 * (toRight.pts.farPx.x - anchor.x)
    );
    for (const k of ["x", "y", "z"]) {
      near(stretched.pose.position[k], toRight.pose.position[k]);
    }
    console.log(`keep-scale ok at plan angle ${angle}`);
  }

  // vertical tie (direction straight above the anchor) runs to the right
  assert.equal(
    computeKeepScaleClonePoints({
      anchorPx: { x: 100, y: 100 },
      directionPx: { x: 100, y: 10 },
      lengthM: 2,
      meterByPx: 0.02,
    }).side,
    1
  );

  // no scale on the elevation: keep-scale is impossible
  const unscaled = { ...makeElevation(), meterByPx: null };
  assert.equal(
    computeVerticalBaseMapPlacementFromLink({
      planBaseMap: makePlan(0),
      elevationBaseMap: unscaled,
      planNorm: { p1, p2 },
      cloneNorm: { q1, q2 },
      keepScale: true,
    }),
    null
  );
  assert.equal(
    computeKeepScaleClonePoints({
      anchorPx: { x: 1, y: 1 },
      directionPx: { x: 2, y: 1 },
      lengthM: 2,
      meterByPx: null,
    }),
    null
  );
  // a plan without scale gives no length
  assert.equal(
    getBaseMapLinkWorldLength({
      planBaseMap: { ...makePlan(0), meterByPx: null },
      planNorm: { p1, p2 },
    }),
    null
  );
  console.log("keep-scale guards ok");
}

// --- default labels ---

{
  assert.equal(getNextBaseMapLinkLabel([]), "A-A");
  assert.equal(getNextBaseMapLinkLabel(["A-A"]), "B-B");
  assert.equal(getNextBaseMapLinkLabel([" a - a ", "C-C"]), "B-B");
  assert.equal(getNextBaseMapLinkLabel(["Coupes", null, undefined]), "A-A");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .map((l) => `${l}-${l}`);
  assert.equal(getNextBaseMapLinkLabel(alphabet), "AA-AA");
  console.log("labels ok");
}

console.log("baseMapLinkPlacementReplay: all checks passed");
