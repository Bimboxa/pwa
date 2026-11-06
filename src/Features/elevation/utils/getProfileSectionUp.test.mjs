// Run with: npx vite-node src/Features/elevation/utils/getProfileSectionUp.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import getInlineExtrusionSetup from "../../annotations/utils/getInlineExtrusionSetup.js";

import getProfileSectionUp, {
  isUprightSectionUp,
  toSectionSample,
} from "./getProfileSectionUp.js";

const near = (a, b, msg, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);

const HORIZONTAL = { orientation: "HORIZONTAL" };
const VERTICAL = { orientation: "VERTICAL", angleDeg: 30 };

// Same mapping as applyProfileFromAnnotationService (straight open guide:
// tStar = 0): source pixels → plan points along the seed normal + heights.
function applyProfile({
  srcPts,
  srcMeterByPx,
  meterByPx,
  segA,
  segB,
  sourceBaseMap,
  targetBaseMap,
  mirror = false,
}) {
  const xRef = srcPts[0].x;
  const yRef = Math.max(...srcPts.map((p) => p.y));
  const len = Math.hypot(segB.x - segA.x, segB.y - segA.y);
  const nx = (segB.y - segA.y) / len;
  const ny = -(segB.x - segA.x) / len;
  const M = { x: (segA.x + segB.x) / 2, y: (segA.y + segB.y) / 2 };
  const sectionUp = getProfileSectionUp({
    sourceBaseMap,
    targetBaseMap,
    segA,
    segB,
  });
  const sideSign = mirror ? -1 : 1;
  const points = srcPts.map((p) => {
    const a = sideSign * (p.x - xRef) * srcMeterByPx;
    const b = (yRef - p.y) * srcMeterByPx;
    const { s, height } = toSectionSample(a, b, sectionUp);
    return {
      x: M.x + (nx * s) / meterByPx,
      y: M.y + (ny * s) / meterByPx,
      height,
    };
  });
  return { points, sectionUp };
}

// « Profil Droit » (base map « Profils », meterByPx 0.0016933…) and the
// first segment of « Guide - Bordure Droite » (« Plan coupe piscine »).
const SRC_METER_BY_PX = 0.0016933333333333331;
const TARGET_METER_BY_PX = 0.016933333333333331;
const PROFIL_DROIT = [
  [2161.942, 283.73],
  [1925.721, 283.73],
  [1925.721, 295.541],
  [1913.91, 295.541],
  [1913.91, 460.896],
  [1795.8, 460.896],
  [1795.8, 295.541],
  [1783.989, 295.541],
  [1783.989, 283.73],
  [1600.918, 283.73],
  [1600.918, 292.509],
  [1591.887, 292.509],
  [1588.303, 283.73],
  [1570.587, 283.73],
].map(([x, y]) => ({ x, y }));
const GUIDE = [
  { x: 429.862, y: 787.914 },
  { x: 456.437, y: 787.914 },
  { x: 1932.815, y: 787.914 },
  { x: 1959.39, y: 787.914 },
];
const PROFILE_WIDTH = (2161.942 - 1570.587) * SRC_METER_BY_PX;
const PROFILE_DEPTH = (460.896 - 283.73) * SRC_METER_BY_PX;

test("default reading unless both base maps are vertical", () => {
  const seg = { segA: { x: 0, y: 0 }, segB: { x: 10, y: 0 } };
  for (const [sourceBaseMap, targetBaseMap] of [
    [HORIZONTAL, HORIZONTAL],
    [HORIZONTAL, VERTICAL],
    [VERTICAL, HORIZONTAL],
    [undefined, undefined],
  ]) {
    const up = getProfileSectionUp({ sourceBaseMap, targetBaseMap, ...seg });
    assert.deepEqual(up, { u: 0, h: 1 });
    assert.equal(isUprightSectionUp(up), false);
  }
});

test("vertical profile on a vertical target: up follows the world vertical", () => {
  const maps = { sourceBaseMap: VERTICAL, targetBaseMap: VERTICAL };
  // Left → right: the right-of-tangent normal is −Y pixel = up.
  assert.deepEqual(
    getProfileSectionUp({
      ...maps,
      segA: { x: 0, y: 5 },
      segB: { x: 10, y: 5 },
    }),
    { u: 1, h: 0 }
  );
  // Right → left: that normal points down.
  assert.deepEqual(
    getProfileSectionUp({
      ...maps,
      segA: { x: 10, y: 5 },
      segB: { x: 0, y: 5 },
    }),
    { u: -1, h: 0 }
  );
  // Sloped guide: still upright (perpendicular of the guide, upper side).
  assert.deepEqual(
    getProfileSectionUp({
      ...maps,
      segA: { x: 0, y: 0 },
      segB: { x: 3, y: 4 },
    }),
    { u: 1, h: 0 }
  );
  // Vertical guide: no "up" in its cross-section plane.
  assert.deepEqual(
    getProfileSectionUp({
      ...maps,
      segA: { x: 5, y: 0 },
      segB: { x: 5, y: 10 },
    }),
    { u: 0, h: 1 }
  );
});

test("default reading: X → plan abscissa, Y → height (unchanged)", () => {
  const { points, sectionUp } = applyProfile({
    srcPts: PROFIL_DROIT,
    srcMeterByPx: SRC_METER_BY_PX,
    meterByPx: TARGET_METER_BY_PX,
    segA: GUIDE[0],
    segB: GUIDE[1],
    sourceBaseMap: VERTICAL,
    targetBaseMap: HORIZONTAL,
  });
  assert.equal(isUprightSectionUp(sectionUp), false);
  const heights = points.map((p) => p.height);
  near(Math.min(...heights), 0, "lowest height");
  near(Math.max(...heights), PROFILE_DEPTH, "highest height");
  // Plan extent along the seed normal (−Y pixel) = the profile's width.
  const ys = points.map((p) => p.y);
  near(
    (Math.max(...ys) - Math.min(...ys)) * TARGET_METER_BY_PX,
    PROFILE_WIDTH,
    "plan extent"
  );
});

test("pool coping replay: the profile stands upright on the vertical guide map", () => {
  const { points, sectionUp } = applyProfile({
    srcPts: PROFIL_DROIT,
    srcMeterByPx: SRC_METER_BY_PX,
    meterByPx: TARGET_METER_BY_PX,
    segA: GUIDE[0],
    segB: GUIDE[1],
    sourceBaseMap: VERTICAL,
    targetBaseMap: VERTICAL,
  });
  assert.deepEqual(sectionUp, { u: 1, h: 0 });

  // Plan chain: from the guide line UP (−Y pixel on a vertical base map) by
  // the profile's depth — the gutter bottom sits on the guide.
  const ys = points.map((p) => p.y);
  near(Math.max(...ys), GUIDE[0].y, "lowest plan point on the guide");
  near(
    (GUIDE[0].y - Math.min(...ys)) * TARGET_METER_BY_PX,
    PROFILE_DEPTH,
    "vertical extent"
  );
  // Heights (along the base map normal) carry the profile's width.
  const heights = points.map((p) => p.height);
  near(Math.min(...heights), 0, "first vertex on the guide plane");
  near(Math.max(...heights), PROFILE_WIDTH, "width along the normal");

  // What the 3D sweep reads.
  const setup = getInlineExtrusionSetup({
    guidePoints: GUIDE,
    profilePoints: points,
  });
  assert.equal(setup.crossedSegIndex, 0);
  const us = setup.crossSection.map((c) => c.u * TARGET_METER_BY_PX);
  near(Math.min(...us), 0, "u min");
  near(Math.max(...us), PROFILE_DEPTH, "u max");
  setup.crossSection.forEach((c, i) => {
    const b = (460.896 - PROFIL_DROIT[i].y) * SRC_METER_BY_PX;
    const a = (PROFIL_DROIT[i].x - PROFIL_DROIT[0].x) * SRC_METER_BY_PX;
    near(c.u * TARGET_METER_BY_PX, b, `u[${i}] = drawn height`);
    near(c.h, -a, `h[${i}] = −drawn abscissa`);
  });
});

test("mirror of an upright profile = heights negated, plan chain untouched", () => {
  const args = {
    srcPts: PROFIL_DROIT,
    srcMeterByPx: SRC_METER_BY_PX,
    meterByPx: TARGET_METER_BY_PX,
    segA: GUIDE[0],
    segB: GUIDE[1],
    sourceBaseMap: VERTICAL,
    targetBaseMap: VERTICAL,
  };
  const plain = applyProfile(args).points;
  const mirrored = applyProfile({ ...args, mirror: true }).points;
  plain.forEach((p, i) => {
    near(mirrored[i].x, p.x, `x[${i}]`);
    near(mirrored[i].y, p.y, `y[${i}]`);
    near(mirrored[i].height, -p.height, `height[${i}]`);
  });
});

test("oblique guide, profile ends at the same level: section not distorted", () => {
  // 3-4-5 guide; the upright plan chain is collinear on its normal and its
  // first / last vertices coincide (same drawn height) → degenerate chord.
  const guide = [
    { x: 100, y: 500 },
    { x: 400, y: 100 },
  ];
  const { points } = applyProfile({
    srcPts: PROFIL_DROIT,
    srcMeterByPx: SRC_METER_BY_PX,
    meterByPx: TARGET_METER_BY_PX,
    segA: guide[0],
    segB: guide[1],
    sourceBaseMap: VERTICAL,
    targetBaseMap: VERTICAL,
  });
  near(
    Math.hypot(
      points[0].x - points[points.length - 1].x,
      points[0].y - points[points.length - 1].y
    ),
    0,
    "coincident ends"
  );
  const setup = getInlineExtrusionSetup({
    guidePoints: guide,
    profilePoints: points,
  });
  const us = setup.crossSection.map((c) => c.u * TARGET_METER_BY_PX);
  setup.crossSection.forEach((c, i) => {
    const b = (460.896 - PROFIL_DROIT[i].y) * SRC_METER_BY_PX;
    near(us[i], b, `u[${i}] = drawn height`);
  });
});
