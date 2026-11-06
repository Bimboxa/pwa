import assert from "node:assert/strict";
import { test } from "node:test";

import { EdgesGeometry } from "three";

import {
  buildSweepArraysForProfile,
  buildSweepGeometryForProfile,
  computeVertexFrames,
} from "./sweepGeometry.js";

const near = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

const vertexAt = (positions, i) => ({
  x: positions[i * 3],
  y: positions[i * 3 + 1],
  z: positions[i * 3 + 2],
});

const areaOf = ({ positions, indices }) => {
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = vertexAt(positions, indices[i]);
    const b = vertexAt(positions, indices[i + 1]);
    const c = vertexAt(positions, indices[i + 2]);
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    area +=
      Math.hypot(
        ab.y * ac.z - ab.z * ac.y,
        ab.z * ac.x - ab.x * ac.z,
        ab.x * ac.y - ab.y * ac.x
      ) / 2;
  }
  return area;
};

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

// V gutter, 2 wide, 1 deep: section length 2√2, chord 2, cap area 1.
const V = [
  { x: 0, y: 0 },
  { x: 1, y: -1 },
  { x: 2, y: 0 },
];
const straight = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 20, y: 0 },
  { x: 30, y: 0 },
];

const sweep = (guide, profile, { hidden = [], flat, closeLine = false } = {}) => {
  const hiddenSet = new Set(hidden);
  const frames = computeVertexFrames(guide, hiddenSet, closeLine);
  return buildSweepArraysForProfile(
    guide,
    frames,
    hiddenSet,
    profile,
    0,
    closeLine,
    flat ? new Set(flat) : undefined
  );
};

test("no flat segment: output unchanged", () => {
  const base = sweep(straight, V);
  assert.deepEqual(sweep(straight, V, { flat: [] }), base);
  // 4 shared rings of 3 vertices, 3 segments × 2 quads.
  assert.equal(base.positions.length / 3, 12);
  assert.equal(base.indices.length / 3, 12);
  near(areaOf(base), 2 * Math.SQRT2 * 30);
});

test("flat middle segment: chord sheet + two caps", () => {
  const arrays = sweep(straight, V, { flat: [1] });
  near(areaOf(arrays), 2 * Math.SQRT2 * 20 + 2 * 10 + 2 * 1);
  // Both joints are closed: every edge in the joint planes is shared by
  // exactly two triangles (profiled sheet + cap, flat sheet + cap).
  for (const x of [10, 20]) {
    const uses = edgeUsesInPlane(arrays, (p) => Math.abs(p.x - x) < 1e-9);
    assert.equal(uses.length, 3);
    assert.ok(uses.every((n) => n === 2), `x=${x}: ${uses}`);
  }
});

test("flat end segment: one cap only, free end stays open", () => {
  const arrays = sweep(straight, V, { flat: [2] });
  near(areaOf(arrays), 2 * Math.SQRT2 * 20 + 2 * 10 + 1);
  const uses = edgeUsesInPlane(arrays, (p) => Math.abs(p.x - 30) < 1e-9);
  assert.deepEqual(uses, [1]);
});

test("hidden neighbour: no cap against a gap", () => {
  const arrays = sweep(straight, V, { hidden: [0], flat: [1] });
  near(areaOf(arrays), 2 * 10 + 2 * Math.SQRT2 * 10 + 1);
});

test("right-angle corner: the cap lies in the miter plane", () => {
  const corner = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  const arrays = sweep(corner, V, { flat: [1] });
  // Miter at (10, 0): rings on the line x + y = 10.
  const inMiter = (p) => Math.abs(p.x + p.y - 10) < 1e-9;
  const uses = edgeUsesInPlane(arrays, inMiter);
  assert.equal(uses.length, 3);
  assert.ok(uses.every((n) => n === 2), `${uses}`);
  // The last 3 vertices are the cap's.
  const count = arrays.positions.length / 3;
  for (let i = count - 3; i < count; i += 1) {
    assert.ok(inMiter(vertexAt(arrays.positions, i)));
  }
});

test("closed guide: the wrap joint gets its cap too", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const base = sweep(square, V, { closeLine: true });
  // Closing segment (3 → 0) flat: joints at vertices 3 and 0.
  const arrays = sweep(square, V, { closeLine: true, flat: [3] });
  // 4 sheet triangles of that segment → 2 (chord band), + 1 per cap.
  assert.equal(arrays.indices.length / 3, base.indices.length / 3 - 4 + 2 + 2);
  // Miter at (0, 0): rings on the line x = y.
  const uses = edgeUsesInPlane(
    arrays,
    (p) => Math.abs(p.x - p.y) < 1e-9 && p.x < 5
  );
  assert.equal(uses.length, 3);
  assert.ok(uses.every((n) => n === 2), `${uses}`);
});

test("closed profile: a flat segment is a gap closed by end caps", () => {
  const tube = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ];
  const arrays = sweep(straight, tube, { flat: [1] });
  // Two 10 m tubes (perimeter 4) + two 1 m² end caps.
  near(areaOf(arrays), 4 * 20 + 2);
});

// Lips + groove: the two lips (0→1 and 2→3) lie ON the chord, i.e. coplanar
// with the flat band; the groove (1 wide, 0.5 deep) hangs under it.
const GROOVE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: -0.5 },
  { x: 2, y: -0.5 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
];

// Black edge lines (EdgesGeometry, same 1° threshold as buildGridEdgeLines)
// lying in the plane x = `x`, as sorted "u,h|u,h" keys (u = −y on this guide).
const edgeLinesAtX = (guide, profile, flat, x) => {
  const hidden = new Set();
  const geom = buildSweepGeometryForProfile(
    guide,
    computeVertexFrames(guide, hidden, false),
    hidden,
    profile,
    0,
    false,
    new Set(flat)
  );
  const pos = new EdgesGeometry(geom, 1).getAttribute("position");
  const out = [];
  const r = (v) => Math.round(v * 1e4) / 1e4 + 0;
  for (let i = 0; i < pos.count; i += 2) {
    if (Math.abs(pos.getX(i) - x) > 1e-6) continue;
    if (Math.abs(pos.getX(i + 1) - x) > 1e-6) continue;
    const ends = [i, i + 1].map((k) => `${r(-pos.getY(k))},${r(pos.getZ(k))}`);
    out.push(ends.sort().join("|"));
  }
  return out.sort();
};

test("profile parts coplanar with the flat band: no edge line at the joint", () => {
  const lines = edgeLinesAtX(straight, GROOVE, [1], 10);
  // Only the groove outline is a real fold: its three walls (sheet ↔ cap)
  // and its mouth (flat band ↔ cap). Nothing along the two lips.
  assert.deepEqual(lines, [
    "1,-0.5|1,0",
    "1,-0.5|2,-0.5",
    "1,0|2,0",
    "2,-0.5|2,0",
  ]);
});

test("flat section is subdivided where the profile meets its chord", () => {
  const arrays = sweep(straight, GROOVE, { flat: [1] });
  // Developed profile 4 m, chord 3 m, groove cap 0.5 m².
  near(areaOf(arrays), 4 * 20 + 3 * 10 + 2 * 0.5);
  // Every edge in the joint plane is shared by exactly two triangles: no
  // T-junction between the lips and the flat band.
  const uses = edgeUsesInPlane(arrays, (p) => Math.abs(p.x - 10) < 1e-9);
  // 5 profile edges + the groove mouth + the cap's own diagonal.
  assert.equal(uses.length, 7);
  assert.ok(uses.every((n) => n === 2), `${uses}`);
});

test("all segments flat: a plain chord band", () => {
  const arrays = sweep(straight, V, { flat: [0, 1, 2] });
  near(areaOf(arrays), 2 * 30);
  assert.equal(arrays.positions.length / 3, 8);
});
