import assert from "node:assert/strict";
import { test } from "node:test";

import applyAffineToPaintGeometry from "./applyAffineToPaintGeometry.js";
import buildHostPartIndex from "./buildHostPartIndex.js";
import {
  localGeometryToPaint,
  paintGeometryToLocal,
} from "./meshPaintFrame.js";
import { faceArea, loopAreaVector } from "./meshPaintGeometry.js";
import {
  METRICS,
  boxTriangles,
  near,
  nearV,
  storedEdge,
  v,
} from "./meshPaintTestFixtures.mjs";
import planPaintResync from "./planPaintResync.js";

const IMAGE = { width: METRICS.imageWidth, height: METRICS.imageHeight };
const CX = IMAGE.width / 2;
const CY = IMAGE.height / 2;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const neg = (n) => v(-n.x, -n.y, -n.z);
const X = v(1, 0, 0);
const Y = v(0, 1, 0);
const Z = v(0, 0, 1);

const storedFaceOf = (contour, normal, holes = []) =>
  localGeometryToPaint(
    "FACE",
    { polygons: [{ contour, holes }], normal },
    METRICS
  );
const toLocal = (partType, geometry) =>
  paintGeometryToLocal(partType, geometry, METRICS);
const apply = (partType, geometry, affine, extra = {}) =>
  applyAffineToPaintGeometry({
    partType,
    geometry,
    affine,
    imageSize: IMAGE,
    metrics: METRICS,
    ...extra,
  });

// Pixel-space maps (what fitAffine2d returns for the host's points).
const translate = (tx, ty) => ({ a: 1, b: 0, c: tx, d: 0, e: 1, f: ty });
// Pixel rotation by +90° about the image center (y down): local (X, Y) →
// (Y, -X).
const ROTATE_90 = { a: 0, b: -1, c: CX + CY, d: 1, e: 0, f: CY - CX };
// Mirror about the image's vertical axis: local X → -X.
const MIRROR_X = { a: -1, b: 0, c: 2 * CX, d: 0, e: 1, f: 0 };

function assertWound(face) {
  for (const polygon of face.polygons) {
    assert.ok(dot(loopAreaVector(polygon.contour), face.normal) > 0);
    for (const hole of polygon.holes) {
      assert.ok(dot(loopAreaVector(hole), face.normal) < 0);
    }
  }
}

const wallFront = [v(1, 0, 0), v(5, 0, 0), v(5, 0, 2.5), v(1, 0, 2.5)];
const window_ = [[v(2, 0, 1), v(2, 0, 2), v(3, 0, 2), v(3, 0, 1)]];

test("translation + dz: plane moves, side and area kept", () => {
  const geometry = storedFaceOf(wallFront, neg(Y), window_);
  // +100 px in x = +1 m; -50 px in y (down) = +0.5 m local y.
  const moved = toLocal(
    "FACE",
    apply("FACE", geometry, translate(100, -50), { dz: 0.3 })
  );
  nearV(moved.normal, neg(Y), 1e-12);
  nearV(moved.polygons[0].contour[0], v(2, 0.5, 0.3), 1e-9);
  near(faceArea(moved), 10 - 1, 1e-9);
  assertWound(moved);
  // Nothing to do: same object.
  assert.equal(apply("FACE", geometry, null), geometry);
  // dz only.
  const lifted = toLocal("FACE", apply("FACE", geometry, null, { dz: -1 }));
  nearV(lifted.polygons[0].contour[0], v(1, 0, -1), 1e-9);
});

test("rotation: the painted side turns with the host", () => {
  const geometry = storedFaceOf(wallFront, neg(Y));
  const rotated = toLocal("FACE", apply("FACE", geometry, ROTATE_90));
  // (X, Y) → (Y, -X): the -y side becomes the -x side, plane x = 0.
  nearV(rotated.normal, neg(X), 1e-9);
  for (const p of rotated.polygons[0].contour) near(p.x, 0, 1e-9);
  near(faceArea(rotated), 10, 1e-9);
  assertWound(rotated);

  // A sloped roof pan keeps its slope through a 30° rotation.
  const roof = storedFaceOf(
    [v(0, 0, 3), v(4, 0, 3), v(4, 2, 4), v(0, 2, 4)],
    v(0, -0.4472135955, 0.894427191)
  );
  const theta = Math.PI / 6;
  const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
  const rot30 = {
    a: cos,
    b: -sin,
    c: CX - cos * CX + sin * CY,
    d: sin,
    e: cos,
    f: CY - sin * CX - cos * CY,
  };
  const before = toLocal("FACE", roof);
  const after = toLocal("FACE", apply("FACE", roof, rot30));
  near(after.normal.z, before.normal.z, 1e-9);
  near(faceArea(after), faceArea(before), 1e-9);
  assertWound(after);
});

test("mirror: the physical side is kept, loops re-wound", () => {
  const right = [v(3, 0, 0), v(3, 1, 0), v(3, 1, 2), v(3, 0, 2)];
  const mirrored = toLocal(
    "FACE",
    apply("FACE", storedFaceOf(right, X), MIRROR_X)
  );
  // The outward +x face of a box at x ∈ [1, 3] becomes the outward -x face
  // of the mirrored box at x ∈ [-3, -1].
  nearV(mirrored.normal, neg(X), 1e-9);
  for (const p of mirrored.polygons[0].contour) near(p.x, -3, 1e-9);
  assertWound(mirrored);
  near(faceArea(mirrored), 2, 1e-9);
});

test("mirror + rotation of a painted box: the re-sync sees nothing to do", () => {
  const box = (sx) =>
    boxTriangles(
      sx > 0 ? v(1, 0, 0) : v(-3, 0, 0),
      sx > 0 ? v(3, 1, 2) : v(-1, 1, 2)
    );
  const rows = [
    {
      id: "right",
      partType: "FACE",
      geometry: storedFaceOf(
        [v(3, 0, 0), v(3, 1, 0), v(3, 1, 2), v(3, 0, 2)],
        X
      ),
    },
    {
      id: "front",
      partType: "FACE",
      geometry: storedFaceOf(
        [v(1, 0, 0), v(3, 0, 0), v(3, 0, 2), v(1, 0, 2)],
        neg(Y)
      ),
    },
    {
      id: "top",
      partType: "FACE",
      geometry: storedFaceOf(
        [v(1, 0, 2), v(3, 0, 2), v(3, 1, 2), v(1, 1, 2)],
        Z
      ),
    },
    {
      id: "edge",
      partType: "EDGE",
      geometry: {
        ...storedEdge(v(1, 0, 2), v(3, 0, 2)),
        sides: [
          [0, 0, 1],
          [0, -1, 0],
        ],
      },
    },
  ].map((row) => ({ ...row, sync: { state: "OK" } }));
  const mirroredRows = rows.map((row) => ({
    ...row,
    geometry: apply(row.partType, row.geometry, MIRROR_X),
  }));
  const plan = planPaintResync({
    rows: mirroredRows,
    index: buildHostPartIndex({ triangles: box(-1) }),
    metrics: METRICS,
  });
  for (const entry of plan) {
    assert.equal(entry.state, "OK", entry.id);
    assert.equal(entry.changed, false, entry.id);
  }
  // The edge's sides followed: still the top (+z) and the front (-y).
  const edgeSides = toLocal("EDGE", mirroredRows[3].geometry).sides;
  assert.ok(edgeSides.some((n) => n.z > 0.999));
  assert.ok(edgeSides.some((n) => n.y < -0.999));

  // Rotated host: same story, sides rotate with the edge.
  const rotatedRows = rows.map((row) => ({
    ...row,
    geometry: apply(row.partType, row.geometry, ROTATE_90),
  }));
  const rotatedPlan = planPaintResync({
    rows: rotatedRows,
    // (X, Y) → (Y, -X): box [1,3]×[0,1] → [0,1]×[-3,-1]
    index: buildHostPartIndex({
      triangles: boxTriangles(v(0, -3, 0), v(1, -1, 2)),
    }),
    metrics: METRICS,
  });
  for (const entry of rotatedPlan) {
    assert.equal(entry.state, "OK", entry.id);
    assert.equal(entry.changed, false, entry.id);
  }
  const rotatedSides = toLocal("EDGE", rotatedRows[3].geometry).sides;
  assert.ok(rotatedSides.some((n) => n.x < -0.999)); // -y → -x
});

test("EDGE points, cross-map paste, missing metrics", () => {
  const edge = storedEdge(v(0, 0, 2.5), v(4, 0, 2.5));
  const moved = toLocal(
    "EDGE",
    apply("EDGE", edge, translate(100, 0), { dz: 0.5 })
  );
  nearV(moved.points[0], v(1, 0, 3), 1e-9);
  nearV(moved.points[1], v(5, 0, 3), 1e-9);

  // Target base map: image twice as big at half the meters per pixel — the
  // map (×2 in pixels) keeps the physical position.
  const target = { imageWidth: 4000, imageHeight: 2000, meterByPx: 0.005 };
  const geometry = storedFaceOf(wallFront, neg(Y), window_);
  const pasted = applyAffineToPaintGeometry({
    partType: "FACE",
    geometry,
    affine: { a: 2, b: 0, c: 0, d: 0, e: 2, f: 0 },
    imageSize: IMAGE,
    targetImageSize: { width: 4000, height: 2000 },
    metrics: METRICS,
    targetMetrics: target,
  });
  const pastedLocal = paintGeometryToLocal("FACE", pasted, target);
  nearV(pastedLocal.normal, neg(Y), 1e-9);
  nearV(pastedLocal.polygons[0].contour[0], v(1, 0, 0), 1e-9);
  near(faceArea(pastedLocal), 9, 1e-9);

  // Without metrics (pixel taken as meter): vertical faces stay exact.
  const noMetrics = applyAffineToPaintGeometry({
    partType: "FACE",
    geometry: storedFaceOf(wallFront, neg(Y)),
    affine: ROTATE_90,
    imageSize: IMAGE,
  });
  nearV(toLocal("FACE", noMetrics).normal, neg(X), 1e-9);
});
