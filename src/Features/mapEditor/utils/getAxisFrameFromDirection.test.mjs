import assert from "node:assert/strict";
import { test } from "node:test";
import getAxisFrameFromDirection from "./getAxisFrameFromDirection.js";
import getAxisSnap from "./getAxisSnap.js";

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

const toRad = (deg) => (deg * Math.PI) / 180;

// Screen direction (y down) at `deg` counter-clockwise from +x
const dirAt = (deg) => ({ x: Math.cos(toRad(deg)), y: -Math.sin(toRad(deg)) });

// Branch directions for a crosshair angle, as in getAxisSnap / ScreenCursorV2
const branchDirs = (angleDeg) => {
  const a = toRad(angleDeg);
  return {
    h: { x: Math.cos(a), y: -Math.sin(a) },
    v: { x: Math.sin(a), y: Math.cos(a) },
  };
};

const cross = (a, b) => a.x * b.y - a.y * b.x;

test("axis-aligned directions keep the crosshair unrotated", () => {
  for (const [deg, crossBranch] of [
    [0, "V"],
    [180, "V"],
    [90, "H"],
    [-90, "H"],
  ]) {
    const frame = getAxisFrameFromDirection(dirAt(deg));
    near(frame.angleDeg, 0, 1e-9, `angle for ${deg}°`);
    assert.equal(frame.crossBranch, crossBranch, `cross branch for ${deg}°`);
  }
});

test("rotation stays within ±45° and one branch runs along the direction", () => {
  for (let deg = -175; deg <= 180; deg += 7) {
    const dir = dirAt(deg);
    const frame = getAxisFrameFromDirection(dir);
    assert.ok(Math.abs(frame.angleDeg) <= 45 + 1e-9, `|angle| for ${deg}°`);
    const { h, v } = branchDirs(frame.angleDeg);
    const along = frame.crossBranch === "V" ? h : v;
    near(cross(along, dir), 0, 1e-9, `along branch parallel for ${deg}°`);
  }
});

test("the direction length does not matter", () => {
  const unit = getAxisFrameFromDirection(dirAt(17));
  const long = getAxisFrameFromDirection({ x: dirAt(17).x * 250, y: dirAt(17).y * 250 });
  near(long.angleDeg, unit.angleDeg, 1e-9, "angle");
  assert.equal(long.crossBranch, unit.crossBranch);
});

test("getAxisSnap: cross-branch lock slides the cursor along the segment", () => {
  // Segment going down-right at 17° off the vertical axis; the target sits
  // 2px before the cross branch through the cursor, 200px sideways.
  const dir = dirAt(-73);
  const normal = { x: -dir.y, y: dir.x };
  const cursor = { x: 400, y: 300 };
  const target = {
    x: cursor.x + dir.x * 2 + normal.x * 200,
    y: cursor.y + dir.y * 2 + normal.y * 200,
  };
  const frame = getAxisFrameFromDirection(dir);
  const result = getAxisSnap({
    candidates: [target],
    cursorScreen: cursor,
    project: (p) => p,
    angleDeg: frame.angleDeg,
    branches: frame.crossBranch,
    snapPx: 3,
    approachPx: 5,
  });
  assert.ok(result?.hasLock, "locked");
  near(result.screen.x, cursor.x + dir.x * 2, 1e-9, "x slid along the segment");
  near(result.screen.y, cursor.y + dir.y * 2, 1e-9, "y slid along the segment");
  assert.deepEqual(result.snappedBranches, { v: false, h: true });
});

test("getAxisSnap: the branch running along the segment never locks", () => {
  // Candidate right on the segment line (e.g. the last placed point)
  const dir = dirAt(-73);
  const cursor = { x: 400, y: 300 };
  const onLine = { x: cursor.x - dir.x * 150, y: cursor.y - dir.y * 150 };
  const frame = getAxisFrameFromDirection(dir);
  const args = {
    candidates: [onLine],
    cursorScreen: cursor,
    project: (p) => p,
    angleDeg: frame.angleDeg,
    snapPx: 3,
    approachPx: 5,
  };
  assert.equal(getAxisSnap({ ...args, branches: frame.crossBranch }), null);
  assert.ok(getAxisSnap(args)?.hasLock, "locks when both branches are allowed");
});
