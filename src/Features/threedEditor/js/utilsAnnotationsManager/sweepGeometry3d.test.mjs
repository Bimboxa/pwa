import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSweepArrays3d,
  computeSegmentFrames3d,
  getGuideLength3d,
  getSweep3dSetup,
  getSweepArea3d,
  hasVerticalGuideOffsets,
} from "./sweepGeometry3d.js";

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

const vertexAt = (positions, i) => ({
  x: positions[i * 3],
  y: positions[i * 3 + 1],
  z: positions[i * 3 + 2],
});

// The user's case (meters, plan y kept as drawn): guide = climb 8.99 above
// A, down to A, A → B (3.28 m along +x), climb 5.47 above B; profile =
// gutter edge drawn flat at z 6.89, starting ON the vertical run at B.
const A = { x: 0, y: 0 };
const B = { x: 3.275, y: 0 };
const guide = [
  { x: A.x, y: A.y, z: 2.46 + 8.99 },
  { x: A.x, y: A.y, z: 2.46 },
  { x: B.x, y: B.y, z: 2.46 },
  { x: B.x, y: B.y, z: 2.46 + 5.47 },
];
const Z = 6.8867;
const profile = [
  { x: 3.275, y: 0, z: Z },
  { x: 3.275, y: 1.14, z: Z },
  { x: 3.943, y: 1.14, z: Z },
  { x: 3.943, y: 0.624, z: Z },
  { x: 4.282, y: 0.624, z: Z },
  { x: 4.282, y: 1.14, z: Z },
];

test("hasVerticalGuideOffsets reads offsetBottom only", () => {
  assert.equal(hasVerticalGuideOffsets([{ offsetBottom: 0 }, {}]), false);
  assert.equal(
    hasVerticalGuideOffsets([{ offsetBottom: 0 }, { offsetBottom: 2 }]),
    true
  );
});

test("flat profile touching a vertical run registers on it, unchanged", () => {
  const setup = getSweep3dSetup({ guidePoints: guide, profilePoints: profile });
  assert.ok(setup);
  assert.equal(setup.segIndex, 2); // the climb above B
  near(Math.abs(setup.frame.t.z), 1);
  // Vertical tangent → the profile plane is already ⟂ t: the section is
  // the drawn gutter, 1.14 m deep, spanning 1.007 m across.
  const us = setup.section.map((c) => c.u);
  const ws = setup.section.map((c) => c.w);
  near(Math.max(...us) - Math.min(...us), 1.007, 1e-3);
  near(Math.max(...ws) - Math.min(...ws), 1.14, 1e-3);
  // First vertex sits on the guide line.
  near(setup.section[0].u, 0);
  near(setup.section[0].w, 0);
});

test("the sweep passes through the drawn profile and follows the climbs", () => {
  const setup = getSweep3dSetup({ guidePoints: guide, profilePoints: profile });
  const hidden = new Set();
  const frames = computeSegmentFrames3d(
    guide,
    hidden,
    false,
    setup.segIndex,
    setup.frame
  );
  assert.equal(frames.filter(Boolean).length, 3);
  const arrays = buildSweepArrays3d(
    guide,
    frames,
    hidden,
    setup.section,
    false
  );
  assert.ok(arrays);
  const { positions } = arrays;
  const count = positions.length / 3;
  // Ring at the top of the climb above B (last ring) = the drawn profile
  // lifted to z 7.93: same plan trace.
  const lastBase = count - profile.length;
  for (let j = 0; j < profile.length; j += 1) {
    const q = vertexAt(positions, lastBase + j);
    near(q.x, profile[j].x, 1e-6);
    near(q.y, profile[j].y, 1e-6);
    near(q.z, 2.46 + 5.47, 1e-6);
  }
  // Along A → B the profile stands upright (its plane ⟂ +x): every ring
  // vertex of the horizontal run keeps x = A.x or x = B.x within the miter.
  const xs = new Set();
  for (let i = 0; i < count; i += 1)
    xs.add(Math.round(vertexAt(positions, i).x * 1000));
  // Vertical runs keep the plan trace at A and B (x spans the gutter depth
  // only there); nothing escapes beyond the gutter width around A / B.
  const minX = Math.min(...xs) / 1000;
  const maxX = Math.max(...xs) / 1000;
  assert.ok(minX >= A.x - 1.2 && maxX <= B.x + 1.2, `${minX} ${maxX}`);
  // Developed area ≈ section length × path length (miters barely change
  // it on right-angle turns of this size).
  const sectionLen = 1.14 + 0.668 + 0.516 + 0.339 + 0.516;
  const pathLen = getGuideLength3d(guide);
  near(pathLen, 8.99 + 3.275 + 5.47, 1e-6);
  const area = getSweepArea3d(arrays);
  assert.ok(
    area > sectionLen * pathLen * 0.8 && area < sectionLen * pathLen * 1.4,
    `${area}`
  );
});

test("hidden vertical run leaves only the horizontal sweep", () => {
  const setup = getSweep3dSetup({ guidePoints: guide, profilePoints: profile });
  const hidden = new Set([0, 2]);
  const frames = computeSegmentFrames3d(guide, hidden, false, 1, setup.frame);
  assert.equal(frames[0], null);
  assert.equal(frames[2], null);
  const arrays = buildSweepArrays3d(
    guide,
    frames,
    hidden,
    setup.section,
    false
  );
  assert.equal(arrays.positions.length / 3, 2 * profile.length);
});

// --- "Extrusion plate" (flat segments + junction caps) ----------------------

// Triangle count per edge lying in the plane `inPlane` (vertices welded by
// position): 2 everywhere = the joint is closed.
const edgeUsesInPlane = ({ positions, indices }, inPlane) => {
  const key = (p) =>
    `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)},${Math.round(p.z * 1e6)}`;
  const uses = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const tri = [0, 1, 2].map((k) => vertexAt(positions, indices[i + k]));
    for (let k = 0; k < 3; k += 1) {
      const p = tri[k];
      const q = tri[(k + 1) % 3];
      if (!inPlane(p) || !inPlane(q)) continue;
      const e = [key(p), key(q)].sort().join("|");
      uses.set(e, (uses.get(e) ?? 0) + 1);
    }
  }
  return [...uses.values()];
};

// V gutter (2 wide, 1 deep) drawn across the guide: section length 2√2,
// chord 2, cap area 1.
const sweepV = (guidePoints, flat, hidden = new Set()) => {
  const setup = getSweep3dSetup({
    guidePoints,
    profilePoints: [
      { x: 5, y: 0, z: 0 },
      { x: 5, y: 1, z: -1 },
      { x: 5, y: 2, z: 0 },
    ],
    hidden,
  });
  const frames = computeSegmentFrames3d(
    guidePoints,
    hidden,
    false,
    setup.segIndex,
    setup.frame
  );
  return buildSweepArrays3d(
    guidePoints,
    frames,
    hidden,
    setup.section,
    false,
    flat
  );
};

test("no flat segment: 3D sweep output unchanged", () => {
  const line = [0, 10, 20, 30].map((x) => ({ x, y: 0, z: 0 }));
  const base = sweepV(line);
  assert.deepEqual(sweepV(line, new Set()), base);
  near(getSweepArea3d(base), 2 * Math.SQRT2 * 30);
});

test("flat middle segment of a straight 3D guide: chord sheet + two caps", () => {
  const line = [0, 10, 20, 30].map((x) => ({ x, y: 0, z: 0 }));
  const arrays = sweepV(line, new Set([1]));
  near(getSweepArea3d(arrays), 2 * Math.SQRT2 * 20 + 2 * 10 + 2 * 1);
  for (const x of [10, 20]) {
    const uses = edgeUsesInPlane(arrays, (p) => Math.abs(p.x - x) < 1e-9);
    assert.equal(uses.length, 3);
    assert.ok(
      uses.every((count) => count === 2),
      `x=${x}: ${uses}`
    );
  }
});

test("flat climbing run: the cap sits in the bisector plane of the joint", () => {
  // Horizontal run then a vertical climb, flagged flat.
  const climb = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 10 },
  ];
  const arrays = sweepV(climb, new Set([1]));
  // Bisector plane at (10, 0, 0): (x − 10) + z = 0.
  const inBisector = (p) => Math.abs(p.x - 10 + p.z) < 1e-9;
  const uses = edgeUsesInPlane(arrays, inBisector);
  assert.equal(uses.length, 3);
  assert.ok(
    uses.every((count) => count === 2),
    `${uses}`
  );
  // Profiled run: 2 quads; flat run: 1 quad; one cap triangle.
  assert.equal(arrays.indices.length / 3, 4 + 2 + 1);
});

test("flat run next to a hidden one: no cap against the gap", () => {
  const line = [0, 10, 20, 30].map((x) => ({ x, y: 0, z: 0 }));
  const arrays = sweepV(line, new Set([1]), new Set([2]));
  near(getSweepArea3d(arrays), 2 * Math.SQRT2 * 10 + 2 * 10 + 1);
});

test("oblique vertical profile on a flat guide is swung perpendicular, chord kept", () => {
  const flat = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  // Vertical profile in a plane at 45° to the guide, 2 m chord, 1 m high.
  const k = Math.SQRT1_2;
  const oblique = [
    { x: 0, y: 0, z: 0 },
    { x: 2 * k, y: 2 * k, z: 0 },
    { x: 2 * k, y: 2 * k, z: 1 },
  ];
  const setup = getSweep3dSetup({ guidePoints: flat, profilePoints: oblique });
  assert.ok(setup);
  near(
    Math.hypot(
      setup.section[1].u - setup.section[0].u,
      setup.section[1].w - setup.section[0].w
    ),
    2
  );
  near(
    Math.hypot(
      setup.section[2].u - setup.section[1].u,
      setup.section[2].w - setup.section[1].w
    ),
    1
  );
});
