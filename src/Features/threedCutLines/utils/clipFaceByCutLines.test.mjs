import assert from "node:assert/strict";
import { test } from "node:test";

import clipFaceByCutLines from "./clipFaceByCutLines.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const v = (x, y, z) => ({ x, y, z });

// 4×4 square in the z=0 plane, normal +z.
const squareZ = () => ({
  contour: [v(0, 0, 0), v(4, 0, 0), v(4, 4, 0), v(0, 4, 0)],
  holes: [],
  normal: v(0, 0, 1),
});

const areas = (pieces) => pieces.map((p) => p.area).sort((a, b) => a - b);

test("a line across a square cuts it in two halves", () => {
  const face = squareZ();
  const cutLines = [[v(-1, 2, 0), v(5, 2, 0)]];

  const result = clipFaceByCutLines({ face, cutLines });
  assert.ok(result);
  assert.equal(result.pieces.length, 2);
  near(result.pieces[0].area, 8);
  near(result.pieces[1].area, 8);
  assert.equal(result.loops2d.length, 1);
  assert.equal(result.loops2d[0].length, 4);
  for (const piece of result.pieces) {
    assert.equal(piece.contour.length, 4);
    assert.deepEqual(piece.holes, []);
    assert.deepEqual(piece.normal, v(0, 0, 1));
    for (const p of piece.contour) near(p.z, 0);
    near(piece.centroid.z, 0);
    near(piece.centroid.x, 2);
    assert.ok(
      Math.abs(piece.centroid.y - 1) < 1e-6 ||
        Math.abs(piece.centroid.y - 3) < 1e-6
    );
  }

  const below = clipFaceByCutLines({ face, cutLines, hitPoint: v(1, 1, 0) });
  const above = clipFaceByCutLines({ face, cutLines, hitPoint: v(1, 3, 0) });
  assert.notEqual(below.hitPieceIndex, -1);
  assert.notEqual(above.hitPieceIndex, -1);
  assert.notEqual(below.hitPieceIndex, above.hitPieceIndex);
  near(below.pieces[below.hitPieceIndex].centroid.y, 1);
  near(above.pieces[above.hitPieceIndex].centroid.y, 3);

  const outside = clipFaceByCutLines({ face, cutLines, hitPoint: v(9, 9, 0) });
  assert.equal(outside.hitPieceIndex, -1);
  assert.equal(result.hitPieceIndex, -1);
});

test("only the run of the line lying on the plane counts", () => {
  const face = squareZ();
  // Across the square at y=2, then climbing a wall (off the plane).
  const climbing = [[v(-1, 2, 0), v(5, 2, 0), v(5, 2, 3), v(5, 6, 3)]];
  const result = clipFaceByCutLines({ face, cutLines: climbing });
  assert.ok(result);
  assert.equal(result.pieces.length, 2);
  near(result.pieces[0].area, 8);
  near(result.pieces[1].area, 8);

  // Coming down a wall onto the plane for a single point, then up again:
  // no run of two points on the plane → no cut.
  const touching = [[v(2, -1, 3), v(2, -1, 0), v(2, -1, 3)]];
  assert.equal(clipFaceByCutLines({ face, cutLines: touching }), null);

  // Down onto the plane, across it, and up again on the other side.
  const dipping = [[v(-1, 2, 3), v(-1, 2, 0), v(5, 2, 0), v(5, 2, 3)]];
  assert.equal(
    clipFaceByCutLines({ face, cutLines: dipping }).pieces.length,
    2
  );
});

test("two crossing lines cut the square in four quarters", () => {
  const face = squareZ();
  const cutLines = [
    [v(-1, 2, 0), v(5, 2, 0)],
    [v(2, -1, 0), v(2, 5, 0)],
  ];
  const result = clipFaceByCutLines({ face, cutLines, hitPoint: v(3, 3, 0) });
  assert.ok(result);
  assert.equal(result.pieces.length, 4);
  for (const area of areas(result.pieces)) near(area, 4);
  near(
    result.pieces.reduce((s, p) => s + p.area, 0),
    16
  );
  assert.notEqual(result.hitPieceIndex, -1);
  const hit = result.pieces[result.hitPieceIndex];
  near(hit.centroid.x, 3);
  near(hit.centroid.y, 3);
});

test("a line off the plane or not crossing the face leaves it uncut", () => {
  const face = squareZ();
  // Parallel to the face, 1 m above it.
  assert.equal(
    clipFaceByCutLines({ face, cutLines: [[v(-1, 2, 1), v(5, 2, 1)]] }),
    null
  );
  // On the plane but dangling inside the face (no end extension).
  assert.equal(
    clipFaceByCutLines({ face, cutLines: [[v(1, 2, 0), v(3, 2, 0)]] }),
    null
  );
  // On the plane but beside the face.
  assert.equal(
    clipFaceByCutLines({ face, cutLines: [[v(-1, 6, 0), v(5, 6, 0)]] }),
    null
  );
  // No lines at all.
  assert.equal(clipFaceByCutLines({ face, cutLines: [] }), null);
  // Within planeTolerance the line still counts as on the plane.
  const slightlyOff = [[v(-1, 2, 0.002), v(5, 2, -0.002)]];
  assert.equal(
    clipFaceByCutLines({ face, cutLines: slightlyOff }).pieces.length,
    2
  );
  assert.equal(
    clipFaceByCutLines({ face, cutLines: slightlyOff, planeTolerance: 1e-4 }),
    null
  );
});

test("a vertical face is cut through its own plane basis", () => {
  // 4×4 face in the y=0 plane, normal +y.
  const face = {
    contour: [v(0, 0, 0), v(4, 0, 0), v(4, 0, 4), v(0, 0, 4)],
    holes: [],
    normal: v(0, 1, 0),
  };
  // Vertical line at x=2 running through the face.
  const result = clipFaceByCutLines({
    face,
    cutLines: [[v(2, 0, -1), v(2, 0, 5)]],
    hitPoint: v(3, 0, 1),
  });
  assert.ok(result);
  assert.equal(result.pieces.length, 2);
  near(result.pieces[0].area, 8);
  near(result.pieces[1].area, 8);
  for (const piece of result.pieces) {
    for (const p of piece.contour) near(p.y, 0);
    near(piece.centroid.y, 0);
    near(piece.centroid.z, 2);
  }
  assert.notEqual(result.hitPieceIndex, -1);
  near(result.pieces[result.hitPieceIndex].centroid.x, 3);

  // Same cut on a wall facing +x (plane x=0).
  const wallX = {
    contour: [v(0, 0, 0), v(0, 0, 4), v(0, 4, 4), v(0, 4, 0)],
    holes: [],
    normal: v(1, 0, 0),
  };
  const resultX = clipFaceByCutLines({
    face: wallX,
    cutLines: [[v(0, -1, 2), v(0, 5, 2)]],
  });
  assert.ok(resultX);
  assert.equal(resultX.pieces.length, 2);
  for (const area of areas(resultX.pieces)) near(area, 8);
  for (const piece of resultX.pieces)
    for (const p of piece.contour) near(p.x, 0);
});

test("a face with a hole keeps the hole on the right piece", () => {
  const face = {
    contour: [v(0, 0, 0), v(10, 0, 0), v(10, 10, 0), v(0, 10, 0)],
    holes: [[v(1, 1, 0), v(1, 3, 0), v(3, 3, 0), v(3, 1, 0)]],
    normal: v(0, 0, 1),
  };
  const result = clipFaceByCutLines({
    face,
    cutLines: [[v(-1, 5, 0), v(11, 5, 0)]],
    hitPoint: v(2, 2, 0),
  });
  assert.ok(result);
  assert.equal(result.loops2d.length, 2);
  assert.equal(result.pieces.length, 2);
  const [small, large] = areas(result.pieces);
  near(small, 46);
  near(large, 50);
  const holed = result.pieces.find((p) => p.holes.length === 1);
  assert.ok(holed);
  near(holed.area, 46);
  // The hit point sits inside the hole: no piece contains it.
  assert.equal(result.hitPieceIndex, -1);
});
