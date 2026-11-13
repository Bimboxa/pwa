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
import computeSectionBaseMapPlacement from "Features/baseMapLinks/utils/computeSectionBaseMapPlacement";

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

// --- « + fond de plan » placement (computeSectionBaseMapPlacement) ---
//
// The previewed pose and the keep-scale clone it returns must agree: fed back
// to the solver (the resync's writer), the clone yields that very pose, for
// any mark heading, direction, page size and in-plane offsets.
{
  const pages = [
    { size: { width: 2480, height: 1754 }, meterByPx: 50 / (5.9055 * 1000) },
    { size: { width: 800, height: 400 }, meterByPx: 0.02 },
  ];
  const marks = [
    { p1: { x: 0.5, y: 0.5 }, p2: { x: 0.7, y: 0.5 } },
    { p1: { x: 0.7, y: 0.5 }, p2: { x: 0.5, y: 0.5 } }, // reversed
    { p1: { x: 0.2, y: 0.8 }, p2: { x: 0.6, y: 0.3 } }, // oblique
    { p1: { x: 0.4, y: 0.1 }, p2: { x: 0.4, y: 0.9 } }, // along image y
  ];
  const offsets = [
    { alongM: 0, upM: 0 },
    { alongM: 1.25, upM: -0.8 },
    { alongM: -3, upM: 2.5 },
  ];
  let count = 0;
  for (const planAngle of [0, 30, -110]) {
    const plan = makePlan(planAngle);
    for (const mark of marks) {
      const A = baseMapNormalizedToWorld(mark.p1, plan);
      const B = baseMapNormalizedToWorld(mark.p2, plan);
      for (const page of pages) {
        for (const offset of offsets) {
          const placement = computeSectionBaseMapPlacement({
            A,
            B,
            size: page.size,
            meterByPx: page.meterByPx,
            ...offset,
          });
          assert.ok(placement);
          const elevation = {
            orientation: "VERTICAL",
            angleDeg: 0,
            position: { x: 0, y: 0, z: 0 },
            meterByPx: page.meterByPx,
            image: { imageSize: page.size },
          };
          const solved = computeVerticalBaseMapPlacementFromLink({
            planBaseMap: plan,
            elevationBaseMap: elevation,
            planNorm: mark,
            cloneNorm: placement.cloneNorm,
            keepScale: true,
          });
          assert.ok(solved);
          near(solved.position.x, placement.position.x, 1e-7);
          near(solved.position.y, placement.position.y, 1e-7);
          near(solved.position.z, placement.position.z, 1e-7);
          near(
            Math.cos((solved.angleDeg * Math.PI) / 180),
            Math.cos((placement.angleDeg * Math.PI) / 180),
            1e-9
          );
          near(
            Math.sin((solved.angleDeg * Math.PI) / 180),
            Math.sin((placement.angleDeg * Math.PI) / 180),
            1e-9
          );
          // the clone's ends, through the pose, land on the mark's ends
          const posed = {
            ...elevation,
            angleDeg: placement.angleDeg,
            position: placement.position,
          };
          const a = baseMapNormalizedToWorld(placement.cloneNorm.q1, posed);
          const b = baseMapNormalizedToWorld(placement.cloneNorm.q2, posed);
          near(a.x, A.x, 1e-7);
          near(a.y, A.y, 1e-7);
          near(a.z, A.z, 1e-7);
          near(b.x, B.x, 1e-7);
          near(b.y, B.y, 1e-7);
          near(b.z, B.z, 1e-7);
          // the page centre moved by the offsets, inside the mark's plane
          const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
          near(
            Math.hypot(
              placement.position.x - mid.x,
              placement.position.z - mid.z
            ),
            Math.abs(offset.alongM),
            1e-7
          );
          near(placement.position.y - A.y, offset.upM, 1e-9);
          count += 1;
        }
      }
    }
  }
  // unusable inputs
  assert.equal(
    computeSectionBaseMapPlacement({
      A: { x: 0, y: 0, z: 0 },
      B: { x: 0, y: 0, z: 0 },
      size: pages[0].size,
      meterByPx: 0.01,
    }),
    null
  );
  assert.equal(
    computeSectionBaseMapPlacement({
      A: { x: 0, y: 0, z: 0 },
      B: { x: 1, y: 0, z: 0 },
      size: pages[0].size,
      meterByPx: null,
    }),
    null
  );
  console.log(`section base map placement ok (${count} cases)`);
}

console.log("baseMapLinkPlacementReplay: all checks passed");
