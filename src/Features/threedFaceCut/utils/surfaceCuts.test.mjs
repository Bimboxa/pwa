import assert from "node:assert/strict";
import { test } from "node:test";

import applyAffineToSurfaceCuts from "./applyAffineToSurfaceCuts.js";
import applySurfaceCutsToSoups from "./applySurfaceCutsToSoups.js";
import computeSurfaceAxisCut, {
  getSurfaceBoundaryPoints,
  getSurfaceCutNormal,
} from "./computeSurfaceAxisCut.js";
import isSurfaceCutHost from "./isSurfaceCutHost.js";
import planSurfacePieces, {
  SURFACE_PIECE_DROP,
  SURFACE_PIECE_KEEP,
  SURFACE_PIECE_REPLACE,
} from "./planSurfacePieces.js";
import {
  getSurfaceCutsKey,
  getSurfaceCutsRemovedM2,
  localToSurfaceCut,
  surfaceCutToLocal,
} from "./surfaceCutsFrame.js";
import {
  getSelectedSurfacePieces,
  getSurfacePiecePartId,
  parseSurfacePiecePartId,
} from "./surfacePieceParts.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

// Open cylinder around the world Y axis (radius 1, height `h`), as a flat
// triangle soup: `turn` × 2π swept from φ = 0.
function cylinderSoup({ h = 2, segments = 32, turn = 1 } = {}) {
  const out = [];
  const phiLength = turn * Math.PI * 2;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * phiLength;
    const a1 = ((i + 1) / segments) * phiLength;
    const p = (a, y) => [Math.cos(a), y, Math.sin(a)];
    out.push(...p(a0, 0), ...p(a1, 0), ...p(a1, h));
    out.push(...p(a0, 0), ...p(a1, h), ...p(a0, h));
  }
  return out;
}

const AXIS_Y = { point: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 1, z: 0 } };
const VIEW_FROM_X = { x: -1, y: 0, z: 0 }; // looking from +x toward the axis

// A plane exactly along a vertex column (φ = 0, π/2…) crosses no triangle —
// like the mailles, the cut needs facets on both sides: the hits below sit
// between two columns.
const PHI = 0.1;
const onRing = (y, phi = PHI) => ({ x: Math.cos(phi), y, z: Math.sin(phi) });
// Meridian plane through φ: holds the Y axis and the ring point.
const meridianPlane = (phi = PHI) => ({
  normal: { x: Math.sin(phi), y: 0, z: -Math.cos(phi) },
  constant: 0,
});

test("isSurfaceCutHost: generated / profiled shapes only", () => {
  assert.equal(isSurfaceCutHost({ shape3D: { key: "REVOLUTION" } }), true);
  assert.equal(isSurfaceCutHost({ shape3D: { key: "SHELL_DOME" } }), true);
  assert.equal(
    isSurfaceCutHost({ type: "DISC", shape3D: { key: "DISC_DOME" } }),
    true
  );
  assert.equal(
    isSurfaceCutHost({
      type: "POLYGON",
      profileLines: [
        {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    }),
    true
  );
  assert.equal(isSurfaceCutHost({ type: "POLYLINE" }), false);
  assert.equal(
    isSurfaceCutHost({ shape3D: { key: "REVOLUTION" }, isMesh3d: true }),
    false
  );
  assert.equal(isSurfaceCutHost({ shape3D: { key: "OTHER" } }), false);
});

test("H cut on a half cylinder: horizontal plane through the cursor, height from the bottom, two pieces", () => {
  const positions = cylinderSoup({ turn: 0.5 });
  const r = computeSurfaceAxisCut({
    positions,
    hitPoint: { x: 0, y: 0.8, z: 1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
  });
  assert.ok(r);
  near(r.plane.normal.y, 1);
  near(r.plane.constant, 0.8);
  near(r.distance, 0.8);
  near(r.ref.y, 0);
  near(r.guide.y, 0.8);
  assert.equal(r.locked, false);
  assert.equal(r.snapped, false);
  assert.equal(r.pieces.length, 2);
  assert.ok(r.segments.length >= 16);
});

test("H cut: the typed height locks the plane from the lowest boundary vertex", () => {
  const positions = cylinderSoup({ turn: 0.5 });
  const r = computeSurfaceAxisCut({
    positions,
    hitPoint: { x: 0, y: 0.3, z: 1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
    typedDistance: 1.2,
  });
  near(r.plane.constant, 1.2);
  near(r.distance, 1.2);
  assert.equal(r.locked, true);
  assert.equal(r.pieces.length, 2);
});

test("H cut: a typed height beyond the surface misses it", () => {
  const positions = cylinderSoup({ turn: 0.5 });
  const r = computeSurfaceAxisCut({
    positions,
    hitPoint: { x: 0, y: 0.3, z: 1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
    typedDistance: 5,
  });
  assert.equal(r, null);
});

test("V cut on a revolution: the meridian plane holds the axis and the hit, a closed ring is only opened", () => {
  const positions = cylinderSoup({ turn: 1 });
  const hitPoint = onRing(1);
  const normal = getSurfaceCutNormal({
    axis: "V",
    hitPoint,
    viewDir: VIEW_FROM_X,
    revolutionAxis: AXIS_Y,
  });
  // Holds the axis and the hit: ⟂ to both.
  near(normal.y, 0);
  near(normal.x * hitPoint.x + normal.z * hitPoint.z, 0);
  // Toward the viewer's right: looking along -x, right is -z.
  assert.ok(normal.z < 0);

  const r = computeSurfaceAxisCut({
    positions,
    hitPoint,
    axis: "V",
    viewDir: VIEW_FROM_X,
    revolutionAxis: AXIS_Y,
  });
  assert.ok(r);
  near(r.plane.constant, 0);
  // Only the chain under the cursor (φ ≈ 0.1), not the opposite one (φ ≈ π).
  assert.ok(r.segments.length >= 1);
  assert.ok(r.segments.every(([p, q]) => p.x > 0.5 && q.x > 0.5));
  assert.equal(r.pieces.length, 1);
});

test("V cut: side RIGHT measures from the opposite boundary end", () => {
  const positions = cylinderSoup({ turn: 0.5 });
  const hitPoint = onRing(1, Math.PI / 2 - PHI); // x ≈ 0.1
  const viewDir = { x: 0, y: 0, z: -1 }; // from +z: right = +x
  const left = computeSurfaceAxisCut({
    positions,
    hitPoint,
    axis: "V",
    side: "LEFT",
    viewDir,
  });
  const right = computeSurfaceAxisCut({
    positions,
    hitPoint,
    axis: "V",
    side: "RIGHT",
    viewDir,
  });
  near(left.plane.normal.x, 1);
  near(left.ref.x, -1);
  near(left.distance, 1 + hitPoint.x);
  near(right.ref.x, 1);
  near(right.distance, 1 - hitPoint.x);
  assert.equal(left.pieces.length, 2);
});

test("applySurfaceCutsToSoups: cuts replay in order, a second meridian splits the opened ring, a stale cut is ignored", () => {
  const soup = cylinderSoup({ turn: 1 });
  const planeZ = meridianPlane();
  const seedA = onRing(1);
  const seedB = onRing(1, PHI + Math.PI);
  const one = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [{ plane: planeZ, seed: seedA }],
  });
  assert.equal(one.applied, 1);
  assert.equal(one.pieces.length, 1);
  assert.equal(one.pieces[0].touched, true);
  assert.ok(one.pieces[0].seams.length >= 1);

  const two = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      { plane: planeZ, seed: seedA },
      { plane: planeZ, seed: seedB },
      // Stale: a horizontal plane above the cylinder.
      {
        plane: { normal: { x: 0, y: 1, z: 0 }, constant: 9 },
        seed: { x: 1, y: 9, z: 0 },
      },
    ],
  });
  assert.equal(two.applied, 2);
  assert.equal(two.pieces.length, 2);
  assert.ok(two.pieces.every((p) => p.sourceIndex === 0 && p.touched));

  // An H cut then: the piece holding the seed is split, the other is kept.
  const three = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      { plane: planeZ, seed: seedA },
      { plane: planeZ, seed: seedB },
      {
        plane: { normal: { x: 0, y: 1, z: 0 }, constant: 1 },
        seed: onRing(1, 1),
      },
    ],
  });
  assert.equal(three.applied, 3);
  assert.equal(three.pieces.length, 3);
});

test("H cut snaps on a seam of a previous cut (a boundary vertex height)", () => {
  const soup = cylinderSoup({ turn: 0.5 });
  const { pieces } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      {
        plane: { normal: { x: 0, y: 1, z: 0 }, constant: 1 },
        seed: { x: 0, y: 1, z: 1 },
      },
    ],
  });
  const top = pieces.find((p) =>
    p.positions.some((v, i) => i % 3 === 1 && v > 1.5)
  );
  const r = computeSurfaceAxisCut({
    positions: top.positions,
    hitPoint: { x: 0, y: 1.3, z: 1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
    snapToleranceM: 0.05,
  });
  // 1.3 is 0.3 from the seam: no snap, height from the piece's bottom (1).
  assert.equal(r.snapped, false);
  near(r.distance, 0.3);
  // Extremal heights (1 and 2) never snap: a plane there does not cut.
  const nearBottom = computeSurfaceAxisCut({
    positions: top.positions,
    hitPoint: { x: 0, y: 1.02, z: 1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
    snapToleranceM: 0.05,
  });
  assert.equal(nearBottom.snapped, false);
  near(nearBottom.plane.constant, 1.02);
});

const METRICS = { imageWidth: 1000, imageHeight: 500, meterByPx: 0.01 };

test("surfaceCutsFrame: local ↔ stored round trip, key stable", () => {
  const local = {
    id: "c1",
    axis: "V",
    plane: { normal: { x: 0.6, y: 0.8, z: 0 }, constant: 2 },
    seed: { x: 1, y: 3, z: 1.5 },
  };
  const stored = localToSurfaceCut(local, METRICS);
  near(stored.normal[0], 0.6);
  near(stored.seed[2], 1.5);
  const back = surfaceCutToLocal(stored, METRICS);
  near(back.plane.constant, 2);
  near(back.seed.x, 1);
  near(back.seed.y, 3);
  near(back.seed.z, 1.5);
  assert.equal(getSurfaceCutsKey([stored]), getSurfaceCutsKey([{ ...stored }]));
  assert.equal(
    surfaceCutToLocal({ id: "x", normal: [0, 0, 0] }, METRICS),
    null
  );
});

test("applyAffineToSurfaceCuts: a rotated / scaled host keeps its cut planes through its points", () => {
  const imageSize = { width: 1000, height: 500 };
  // 90° rotation about the image center + ×2 scale, in pixels.
  const cx = 500;
  const cy = 250;
  const s = 2;
  const affine = { a: 0, b: -s, c: cx + s * cy, d: s, e: 0, f: cy - s * cx };
  const toLocal = ([nx, ny, z]) => ({
    x: (nx * imageSize.width - cx) * 0.01,
    y: -(ny * imageSize.height - cy) * 0.01,
    z,
  });
  const normal = [0.6, 0.8, 0];
  const point = [0.3, 0.4, 1];
  // A second point on the plane: point + t × (in-plane direction).
  const inPlanePx = { x: 0.8, y: -0.6 }; // ⟂ to the normal in local meters
  const other = [
    point[0] + (inPlanePx.x * 50) / imageSize.width,
    point[1] - (inPlanePx.y * 50) / imageSize.height,
    1,
  ];
  const [cut] = applyAffineToSurfaceCuts(
    [{ id: "c", axis: "V", normal, point, seed: other }],
    affine,
    imageSize,
    { dz: 0.5 }
  );
  const n = { x: cut.normal[0], y: cut.normal[1], z: cut.normal[2] };
  const p = toLocal(cut.point);
  const q = toLocal(cut.seed);
  near(n.x * (q.x - p.x) + n.y * (q.y - p.y) + n.z * (q.z - p.z), 0, 1e-9);
  near(cut.point[2], 1.5);
  near(Math.hypot(n.x, n.y, n.z), 1);
});

test("H cut on a closed surface (torus): the reference is its lowest vertex, no boundary needed", () => {
  // Tube around the Y axis: ring radius 3, tube radius 1 (closed, no boundary).
  const out = [];
  const N = 24;
  const M = 12;
  const at = (i, j) => {
    const a = (i / N) * Math.PI * 2;
    const b = (j / M) * Math.PI * 2;
    const r = 3 + Math.cos(b);
    return [r * Math.cos(a), Math.sin(b), r * Math.sin(a)];
  };
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      out.push(...at(i, j), ...at(i + 1, j), ...at(i + 1, j + 1));
      out.push(...at(i, j), ...at(i + 1, j + 1), ...at(i, j + 1));
    }
  }
  assert.equal(getSurfaceBoundaryPoints(out).length, 0);
  const r = computeSurfaceAxisCut({
    positions: out,
    hitPoint: { x: 4, y: 0.3, z: 0.1 },
    axis: "H",
    viewDir: VIEW_FROM_X,
    // (1.5 would land exactly on a vertex row — y = sin 30° — which no
    // triangle crosses.)
    typedDistance: 1.4,
  });
  assert.ok(r);
  near(r.ref.y, -1);
  near(r.plane.constant, 0.4);
  near(r.distance, 1.4);
});

test("H hover near a vertical seam vertex: no snap on a lone level, the cursor plane always draws", () => {
  // Wedge between two meridians: its seams hold a vertex at every lathe row.
  const soup = cylinderSoup({ turn: 1, segments: 32, h: 2 });
  const { pieces } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      { plane: meridianPlane(0.1), seed: onRing(1, 0.1) },
      { plane: meridianPlane(0.9), seed: onRing(1, 0.9) },
    ],
  });
  const wedge = pieces.find(
    (p) => p.positions.length < soup.length / 2 && p.seams.length >= 2
  );
  assert.ok(wedge);
  // Vertex rows of this cylinder sit at y = 0 and 2 only, but the seams add
  // clip vertices at the diagonals' heights: hover 5 mm off one of them with
  // a 5 cm tolerance.
  const seamYs = wedge.seams
    .flat()
    .map((p) => p.y)
    .filter((y) => y > 0.1 && y < 1.9);
  assert.ok(seamYs.length >= 1);
  const r = computeSurfaceAxisCut({
    positions: wedge.positions,
    hitPoint: onRing(seamYs[0] + 0.005, 0.5),
    axis: "H",
    viewDir: VIEW_FROM_X,
    snapToleranceM: 0.05,
  });
  assert.ok(r);
  assert.equal(r.snapped, false);
  near(r.plane.constant, seamYs[0] + 0.005);
});

test("H hover on a band whose only shared levels are its rims: no snap, the cursor plane is used", () => {
  const soup = cylinderSoup({ turn: 0.5, h: 3 });
  const { pieces } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      {
        plane: { normal: { x: 0, y: 1, z: 0 }, constant: 1 },
        seed: onRing(1, 1),
      },
    ],
  });
  const top = pieces.find((p) =>
    p.positions.some((v, i) => i % 3 === 1 && v > 2.5)
  );
  // Its levels (1 and 3) are extremal: never snapped on, even within reach.
  const r = computeSurfaceAxisCut({
    positions: top.positions,
    hitPoint: onRing(1.2, 1),
    axis: "H",
    viewDir: VIEW_FROM_X,
    snapToleranceM: 0.5,
  });
  assert.ok(r);
  assert.equal(r.snapped, false);
  near(r.plane.constant, 1.2);
  near(r.distance, 0.2);
});

test("removal: the piece holding the point is dropped, a stale point is ignored, later cuts skip it", () => {
  const soup = cylinderSoup({ turn: 0.5, h: 2 });
  const planeH = { normal: { x: 0, y: 1, z: 0 }, constant: 1 };
  const { pieces, applied } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [
      { plane: planeH, seed: onRing(1, 1) },
      // A point on the top band's surface (radius 1, y = 1.5).
      { remove: onRing(1.5, 1) },
      // Off the surface by 10 cm: ignored.
      { remove: { x: 1.1 * Math.cos(1), y: 0.5, z: 1.1 * Math.sin(1) } },
      // A second H cut aimed at the bottom band.
      {
        plane: { normal: { x: 0, y: 1, z: 0 }, constant: 0.5 },
        seed: onRing(0.5, 1),
      },
    ],
  });
  assert.equal(applied, 3);
  const removed = pieces.filter((p) => p.removed);
  const kept = pieces.filter((p) => !p.removed);
  assert.equal(removed.length, 1);
  assert.ok(removed[0].positions.some((v, i) => i % 3 === 1 && v > 1.5));
  assert.equal(kept.length, 2);
  assert.ok(
    kept.every((p) => p.positions.every((v, i) => i % 3 !== 1 || v <= 1 + 1e-9))
  );
});

test("surfaceCutsFrame: a REMOVE entry converts to a local point and counts its area", () => {
  const cuts = [
    {
      id: "a",
      axis: "H",
      point: [0.5, 0.5, 1],
      normal: [0, 0, 1],
      seed: [0.5, 0.5, 1],
    },
    { id: "b", kind: "REMOVE", point: [0.5, 0.5, 2], surface: 1.25 },
    { id: "c", kind: "REMOVE", point: [0.4, 0.5, 2], surface: 0.5 },
  ];
  assert.equal(getSurfaceCutsRemovedM2(cuts), 1.75);
  const local = surfaceCutToLocal(cuts[1], METRICS);
  assert.equal(local.kind, "REMOVE");
  near(local.point.z, 2);
  assert.notEqual(getSurfaceCutsKey(cuts), getSurfaceCutsKey(cuts.slice(0, 2)));
  assert.equal(surfaceCutToLocal({ kind: "REMOVE" }, METRICS), null);
});

test("surfacePieceParts: ids round trip, selection filtered on the selected annotation", () => {
  const id = getSurfacePiecePartId("a1", 3);
  assert.deepEqual(parseSurfacePiecePartId(id), {
    annotationId: "a1",
    partType: "SURFACE_PIECE",
    pieceIndex: 3,
  });
  assert.equal(parseSurfacePiecePartId("a1::MESH3D_FACE::3"), null);
  const item = { type: "NODE", nodeId: "a1", partId: id };
  assert.equal(getSelectedSurfacePieces(item, []).length, 1);
  assert.equal(
    getSelectedSurfacePieces(item, [id, getSurfacePiecePartId("a2", 1)]).length,
    1
  );
});

test("planSurfacePieces: no cut → every source is a piece in place, in order", () => {
  const plan = planSurfacePieces(3, null);
  assert.deepEqual(plan, [
    { kind: SURFACE_PIECE_KEEP, index: 0 },
    { kind: SURFACE_PIECE_KEEP, index: 1 },
    { kind: SURFACE_PIECE_KEEP, index: 2 },
  ]);
});

test("planSurfacePieces: a removal alone on a single uncut source drops it", () => {
  const soup = cylinderSoup({ turn: 0.5, h: 2 });
  const { pieces, applied } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }],
    cuts: [{ remove: onRing(1, 1) }],
  });
  assert.equal(applied, 1);
  assert.deepEqual(planSurfacePieces(1, pieces), [
    { kind: SURFACE_PIECE_DROP },
  ]);
});

test("planSurfacePieces: an untouched source, a split one, an untouched one share one index sequence", () => {
  const soup = cylinderSoup({ turn: 0.5, h: 2 });
  const planeH = { normal: { x: 0, y: 1, z: 0 }, constant: 1 };
  // Three copies of the half cylinder, the middle one shifted 10 m away on
  // x so the H cut (seeded on it) reaches no other soup.
  const shifted = soup.map((v, i) => (i % 3 === 0 ? v + 10 : v));
  const { pieces } = applySurfaceCutsToSoups({
    soups: [{ positions: soup }, { positions: shifted }, { positions: soup }],
    cuts: [
      {
        plane: planeH,
        seed: { x: 10 + Math.cos(1), y: 1, z: Math.sin(1) },
      },
    ],
  });
  const plan = planSurfacePieces(3, pieces);
  assert.equal(plan[0].kind, SURFACE_PIECE_KEEP);
  assert.equal(plan[0].index, 0);
  assert.equal(plan[1].kind, SURFACE_PIECE_REPLACE);
  assert.deepEqual(
    plan[1].pieces.map((p) => p.index),
    [1, 2]
  );
  assert.ok(plan[1].pieces.every((p) => p.piece.touched));
  assert.equal(plan[2].kind, SURFACE_PIECE_KEEP);
  assert.equal(plan[2].index, 3);
});
