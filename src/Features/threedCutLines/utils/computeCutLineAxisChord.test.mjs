import assert from "node:assert/strict";
import { test } from "node:test";

import computeCutLineAxisChord from "./computeCutLineAxisChord.js";

const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);
const nearPoint = (a, b) => {
  near(a.x, b.x);
  near(a.y, b.y);
  near(a.z, b.z);
};

// Horizontal slab 4 (x) × 3 (z) at y = 0, normal up (Y-up scene).
const SLAB = {
  contour: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ],
  holes: [],
  normal: { x: 0, y: 1, z: 0 },
};

test("axis X on a slab: the chord runs along X at the cursor's z", () => {
  const r = computeCutLineAxisChord({
    face: SLAB,
    axisDir: { x: 1, y: 0, z: 0 },
    cursor: { x: 1, y: 0, z: 1.2 },
  });
  assert.equal(r.usable, true);
  assert.ok(r.chord);
  const xs = r.chord.map((p) => p.x).sort((a, b) => a - b);
  near(xs[0], 0);
  near(xs[1], 4);
  r.chord.forEach((p) => {
    near(p.y, 0);
    near(p.z, 1.2);
  });
});

test("axis Z on the same slab: the chord runs along Z at the cursor's x", () => {
  const r = computeCutLineAxisChord({
    face: SLAB,
    axisDir: { x: 0, y: 0, z: 1 },
    cursor: { x: 2.5, y: 0, z: 1 },
  });
  assert.equal(r.usable, true);
  r.chord.forEach((p) => near(p.x, 2.5));
  const zs = r.chord.map((p) => p.z).sort((a, b) => a - b);
  near(zs[0], 0);
  near(zs[1], 3);
});

test("an axis normal to the face is unusable", () => {
  const r = computeCutLineAxisChord({
    face: SLAB,
    axisDir: { x: 0, y: 1, z: 0 },
    cursor: { x: 2, y: 0, z: 1 },
  });
  assert.equal(r.usable, false);
});

test("a rotated axis (45°) gives a diagonal chord; the offset guide snaps", () => {
  const s = Math.SQRT1_2;
  const axisDir = { x: s, y: 0, z: s };
  // First pass: the frame (reference corner, across direction v).
  const probe = computeCutLineAxisChord({
    face: SLAB,
    axisDir,
    cursor: { x: 2, y: 0, z: 1 },
  });
  assert.equal(probe.usable, true);
  const { ref, basis } = probe;
  // Cursor 1.2 m across from the reference (within 0.5 m of the 1 m guide),
  // shifted along the axis to stay inside the slab.
  const cursor = {
    x: ref.x + 1.2 * basis.v.x + 1.5 * basis.u.x,
    y: 0,
    z: ref.z + 1.2 * basis.v.z + 1.5 * basis.u.z,
  };
  const r = computeCutLineAxisChord({
    face: SLAB,
    axisDir,
    cursor,
    offset: 1,
    snapToleranceM: 0.5,
  });
  assert.equal(r.usable, true);
  const [a, b] = r.chord;
  const d = { x: b.x - a.x, z: b.z - a.z };
  // Direction parallel to the axis (|dx| == |dz|).
  near(Math.abs(d.x) - Math.abs(d.z), 0, 1e-9);
  // Snapped on the guide at 1 m from the reference, across the chord.
  near(r.distance, 1);
  assert.equal(r.snapped, true);
  nearPoint(r.guide, {
    x: r.ref.x + r.basis.v.x,
    y: r.ref.y + r.basis.v.y,
    z: r.ref.z + r.basis.v.z,
  });
});
