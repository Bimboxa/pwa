// Run with: npx vite-node src/Features/reconstruction3d/utils/getCameraPathPoseAtTime.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import getCameraPathPoseAtTime, {
  getCameraPathSamples,
} from "./getCameraPathPoseAtTime.js";

const samples = [
  { timeS: 0, position: [0, 1, 0], forward: [0, 0, -1], hfovDeg: 60 },
  { timeS: 2, position: [4, 1, 0], forward: [1, 0, 0], hfovDeg: 70 },
  { timeS: 3, position: [4, 3, 0], forward: [1, 0, 0], hfovDeg: null },
];

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("no sample: null", () => {
  assert.equal(getCameraPathPoseAtTime([], 1), null);
  assert.equal(getCameraPathPoseAtTime(null, 1), null);
});

test("holds the first and the last sample outside the path", () => {
  assert.deepEqual(getCameraPathPoseAtTime(samples, -1).position, [0, 1, 0]);
  assert.deepEqual(getCameraPathPoseAtTime(samples, 9).position, [4, 3, 0]);
});

test("interpolates the position linearly", () => {
  const pose = getCameraPathPoseAtTime(samples, 0.5);
  assert.deepEqual(pose.position, [1, 1, 0]);
  near(pose.hfovDeg, 62.5);
});

test("the interpolated direction stays a unit vector", () => {
  const { forward } = getCameraPathPoseAtTime(samples, 1);
  near(Math.hypot(...forward), 1);
  near(forward[0], Math.SQRT1_2);
  near(forward[2], -Math.SQRT1_2);
});

test("a missing fov falls back on the neighbour", () => {
  assert.equal(getCameraPathPoseAtTime(samples, 2.5).hfovDeg, 70);
});

test("samples: frames with a time and a pose, sorted by time", () => {
  const frames = [
    { timeS: 2, pose: { position: [1, 0, 0], forward: [0, 0, -1] } },
    { timeS: null, pose: { position: [9, 0, 0], forward: [0, 0, -1] } },
    { timeS: 1, pose: null },
    { timeS: 0, pose: { position: [0, 0, 0], forward: [0, 0, -1] } },
  ];
  assert.deepEqual(
    getCameraPathSamples(frames).map((s) => s.timeS),
    [0, 2]
  );
});
