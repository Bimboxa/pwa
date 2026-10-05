// node --test src/Features/meshPaint/utils/meshPaintCurved.test.mjs
//
// Curved parts end to end on the pure utils: a smooth surface (indexed
// facets) and a curve (N points) through the frame conversions, the
// quantities, the matcher, the re-sync and the coordinate rewrites.
import assert from "node:assert/strict";
import test from "node:test";

import applyAffineToPaintGeometry from "./applyAffineToPaintGeometry.js";
import buildHostPartIndex from "./buildHostPartIndex.js";
import classifyMeshPaintsForSplit from "./classifyMeshPaintsForSplit.js";
import findMeshPaintMatches from "./findMeshPaintMatches.js";
import getMeshPaintPartQties from "./getMeshPaintPartQties.js";
import mapPaintGeometryXY from "./mapPaintGeometryXY.js";
import {
  localGeometryToPaint,
  paintGeometryToLocal,
} from "./meshPaintFrame.js";
import { getPolygonNormal } from "./meshPaintGeometry.js";
import {
  METRICS,
  boxTriangles,
  cylinderTriangles,
  near,
  v,
} from "./meshPaintTestFixtures.mjs";
import planPaintResync, { matchPaintPartToIndex } from "./planPaintResync.js";
import triangulatePaintFace from "./triangulatePaintFace.js";

const SEGMENTS = 32;
const RADIUS = 2;
const ANGLE = 25;
const CHORD = 2 * RADIUS * Math.sin(Math.PI / SEGMENTS);

const cylinder = (options = {}) =>
  buildHostPartIndex({
    triangles: cylinderTriangles({
      radius: RADIUS,
      segments: SEGMENTS,
      caps: true,
      ...options,
    }),
  });

// One wall facet of the index, as the planar face a click picks.
function wallFacet(index) {
  const island = index.islands.find((i) => Math.abs(i.normal.z) < 0.5);
  return { polygons: island.polygons, normal: island.normal };
}

function growWall(index) {
  return matchPaintPartToIndex("FACE", wallFacet(index), index, {
    allowFar: false,
    smoothAngleDeg: ANGLE,
  });
}

const row = (partType, geometry, extra = {}) => ({
  id: "p1",
  partType,
  baseMapId: "bm",
  geometry,
  sync: { state: "OK" },
  ...extra,
});

test("a facet of a cylinder grows into the whole wall, outward", () => {
  const index = cylinder();
  const grown = growWall(index);
  assert.ok(grown.surfaceKey);
  const face = grown.geometry;
  assert.equal(face.curved, true);
  assert.equal(face.angleDeg, ANGLE);
  assert.equal(face.polygons.length, SEGMENTS);
  for (const polygon of face.polygons) {
    const n = getPolygonNormal(polygon);
    const c = polygon.contour[0];
    assert.ok(n.x * c.x + n.y * c.y > 0, "facet wound outward");
  }
  // Without the smoothing angle: the planar facet, as before.
  const planar = matchPaintPartToIndex("FACE", wallFacet(index), index, {
    allowFar: false,
  });
  assert.equal(planar.geometry.curved, undefined);
  assert.equal(planar.geometry.polygons.length, 1);
});

test("stored form: indexed facets, shared vertices once, round trip", () => {
  const face = growWall(cylinder()).geometry;
  const stored = localGeometryToPaint("FACE", face, METRICS);
  assert.equal(stored.vertices.length, 2 * SEGMENTS);
  assert.equal(stored.facets.length, SEGMENTS);
  assert.equal(stored.angleDeg, ANGLE);
  assert.equal(stored.polygons, undefined);
  assert.equal(stored.normal, undefined);

  const back = paintGeometryToLocal("FACE", stored, METRICS);
  assert.equal(back.curved, true);
  assert.equal(back.angleDeg, ANGLE);
  assert.equal(back.polygons.length, SEGMENTS);
  const qties = getMeshPaintPartQties(row("FACE", stored), METRICS);
  near(qties.surface, SEGMENTS * CHORD * 3, 1e-6);

  const { positions, normals } = triangulatePaintFace(back, { lift: 0.001 });
  assert.equal(positions.length, SEGMENTS * 2 * 9);
  // Flat normals per facet, all radial.
  for (let i = 0; i < normals.length; i += 3) {
    near(normals[i + 2], 0, 1e-9);
    assert.ok(
      normals[i] * positions[i] + normals[i + 1] * positions[i + 1] > 0
    );
  }
});

test("matcher: a facet painted on its own is part of the surface", () => {
  const index = cylinder();
  const surface = row(
    "FACE",
    localGeometryToPaint("FACE", growWall(index).geometry, METRICS)
  );
  const facet = row(
    "FACE",
    localGeometryToPaint("FACE", wallFacet(index), METRICS),
    { id: "p2" }
  );
  const cap = index.islands.find((i) => i.normal.z > 0.5);
  const top = row("FACE", localGeometryToPaint("FACE", cap, METRICS), {
    id: "p3",
  });
  const matches = findMeshPaintMatches({
    candidate: { ...surface, id: undefined },
    rows: [surface, facet, top],
    metrics: METRICS,
  });
  assert.deepEqual(
    matches.map((m) => m.id),
    ["p1", "p2"]
  );
});

test("re-sync: a taller cylinder keeps its painted wall, whole", () => {
  const stored = localGeometryToPaint(
    "FACE",
    growWall(cylinder()).geometry,
    METRICS
  );
  const taller = cylinder({ z1: 4 });
  const [same] = planPaintResync({
    rows: [row("FACE", stored)],
    index: cylinder(),
    metrics: METRICS,
  });
  assert.equal(same.state, "OK");
  assert.equal(same.changed, false);
  assert.equal(same.geometry, stored);

  const [plan] = planPaintResync({
    rows: [row("FACE", stored)],
    index: taller,
    metrics: METRICS,
  });
  assert.equal(plan.state, "OK");
  assert.equal(plan.changed, true);
  assert.equal(plan.geometry.facets.length, SEGMENTS);
  assert.equal(plan.geometry.angleDeg, ANGLE);
  near(
    getMeshPaintPartQties(row("FACE", plan.geometry), METRICS).surface,
    SEGMENTS * CHORD * 4,
    1e-6
  );
});

test("re-sync: a wider cylinder is followed, an unrelated host is not", () => {
  const stored = localGeometryToPaint(
    "FACE",
    growWall(cylinder()).geometry,
    METRICS
  );
  // Same tessellation, larger radius: every facet was pushed along its
  // normal (Stage 2).
  const [wider] = planPaintResync({
    rows: [row("FACE", stored)],
    index: cylinder({ radius: 2.5 }),
    metrics: METRICS,
  });
  assert.equal(wider.state, "OK");
  assert.equal(wider.geometry.facets.length, SEGMENTS);

  const [plan] = planPaintResync({
    rows: [row("FACE", stored)],
    index: buildHostPartIndex({
      triangles: boxTriangles(v(-2, -2, 0), v(2, 2, 3)),
    }),
    metrics: METRICS,
  });
  assert.equal(plan.state, "ORPHAN");
  assert.equal(plan.geometry, stored);
});

test("open sheet: the surface faces the picked side", () => {
  const index = buildHostPartIndex({
    triangles: cylinderTriangles({ segments: 16, sweep: Math.PI }),
  });
  const island = index.islands[3];
  for (const sign of [1, -1]) {
    const picked =
      sign > 0
        ? { polygons: island.polygons, normal: island.normal }
        : {
            polygons: island.polygons,
            normal: {
              x: -island.normal.x,
              y: -island.normal.y,
              z: -island.normal.z,
            },
          };
    const grown = matchPaintPartToIndex("FACE", picked, index, {
      allowFar: false,
      smoothAngleDeg: ANGLE,
    });
    assert.equal(grown.geometry.polygons.length, 16);
    const radial = grown.geometry.polygons.map((polygon) => {
      const n = getPolygonNormal(polygon);
      return n.x * polygon.contour[0].x + n.y * polygon.contour[0].y;
    });
    const want = Math.sign(
      picked.normal.x * island.centroid.x + picked.normal.y * island.centroid.y
    );
    assert.ok(radial.every((r) => Math.sign(r) === want));
  }
});

test("mirror: the loops of a curved surface are reversed", () => {
  const face = growWall(cylinder()).geometry;
  const stored = localGeometryToPaint("FACE", face, METRICS);
  const mirrored = applyAffineToPaintGeometry({
    partType: "FACE",
    geometry: stored,
    // x → width − x (image pixels)
    affine: { a: -1, b: 0, c: METRICS.imageWidth, d: 0, e: 1, f: 0 },
    imageSize: { width: METRICS.imageWidth, height: METRICS.imageHeight },
    metrics: METRICS,
  });
  const local = paintGeometryToLocal("FACE", mirrored, METRICS);
  for (const polygon of local.polygons) {
    const n = getPolygonNormal(polygon);
    const c = polygon.contour[0];
    assert.ok(n.x * c.x + n.y * c.y > 0, "still outward");
  }
  const shifted = mapPaintGeometryXY("FACE", stored, ({ x, y }) => ({
    x: x + 0.1,
    y,
  }));
  near(shifted.vertices[0][0], stored.vertices[0][0] + 0.1, 1e-12);
  assert.equal(shifted.facets, stored.facets);
});

test("curve: a rim is one closed N-point edge, measured and re-synced", () => {
  const index = cylinder();
  const { curves } = index.getCurves(ANGLE);
  const rim = curves.find(
    (curve) => curve.points.length > 2 && curve.points[0].z === 3
  );
  const local = { points: rim.points, sides: rim.sides, angleDeg: ANGLE };
  const stored = localGeometryToPaint("EDGE", local, METRICS);
  assert.equal(stored.points.length, SEGMENTS + 1);
  assert.equal(stored.angleDeg, ANGLE);
  near(
    getMeshPaintPartQties(row("EDGE", stored), METRICS).length,
    SEGMENTS * CHORD,
    1e-6
  );

  // Same host: nothing to write.
  const [same] = planPaintResync({
    rows: [row("EDGE", stored)],
    index,
    metrics: METRICS,
  });
  assert.equal(same.state, "OK");
  assert.equal(same.changed, false);

  // Taller host: the top rim follows (same facets on its sides).
  const [plan] = planPaintResync({
    rows: [row("EDGE", stored)],
    index: cylinder({ z1: 4 }),
    metrics: METRICS,
  });
  assert.equal(plan.state, "OK");
  assert.equal(plan.geometry.points.length, SEGMENTS + 1);
  assert.ok(plan.geometry.points.every((p) => Math.abs(p[2] - 4) < 1e-9));

  // One of its segments painted on its own is the same part.
  const segment = row(
    "EDGE",
    localGeometryToPaint(
      "EDGE",
      { points: [rim.points[4], rim.points[5]] },
      METRICS
    ),
    { id: "p2" }
  );
  const matches = findMeshPaintMatches({
    candidate: { ...row("EDGE", stored), id: undefined },
    rows: [segment],
    metrics: METRICS,
  });
  assert.equal(matches.length, 1);
});

test("split: a curved wall paint spans the two halves", () => {
  const stored = localGeometryToPaint(
    "FACE",
    growWall(cylinder()).geometry,
    METRICS
  );
  const half = (hostId, x0, x1) => ({
    hostId,
    kind: "POLYGON",
    outline: [
      { x: x0, y: -3 },
      { x: x1, y: -3 },
      { x: x1, y: 3 },
      { x: x0, y: 3 },
    ],
  });
  const [result] = classifyMeshPaintsForSplit({
    rows: [row("FACE", stored)],
    metrics: METRICS,
    sourceHostId: "a",
    pieces: [half("a", -3, 0), half("b", 0, 3)],
  });
  assert.equal(result.kind, "SPAN");
  assert.deepEqual(result.copyTo, ["b"]);
});
