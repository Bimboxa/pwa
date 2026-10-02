import assert from "node:assert/strict";
import { test } from "node:test";

import { ExtrudeGeometry, Path, Shape } from "three";

import buildHostPartIndex, { probeNormalSide } from "./buildHostPartIndex.js";
import { loopAreaVector } from "./meshPaintGeometry.js";
import triangulatePaintFace from "./triangulatePaintFace.js";
import {
  boxTriangles,
  findIsland,
  near,
  nearV,
  quadTriangles,
  soupOfGeometry,
  v,
  wallTriangles,
} from "./meshPaintTestFixtures.mjs";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const X = v(1, 0, 0);
const Y = v(0, 1, 0);
const Z = v(0, 0, 1);
const neg = (n) => v(-n.x, -n.y, -n.z);
const chainLengths = (index) =>
  index.chains
    .map((chain) => Math.round(chain.length * 1000) / 1000)
    .sort((a, b) => a - b);

function assertIslandsWound(index) {
  for (const island of index.islands) {
    for (const polygon of island.polygons) {
      assert.ok(dot(loopAreaVector(polygon.contour), island.normal) > 0);
      for (const hole of polygon.holes) {
        assert.ok(dot(loopAreaVector(hole), island.normal) < 0);
      }
    }
  }
}

test("closed box with inconsistent windings: 6 outward islands, 12 edges", () => {
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(4, 2, 3), {
      flip: ["top", "left", "back"],
    }),
  });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, 6);
  const expected = [
    [neg(Y), 0, 12],
    [Y, 2, 12],
    [neg(Z), 0, 8],
    [Z, 3, 8],
    [neg(X), 0, 6],
    [X, 4, 6],
  ];
  for (const [n, offset, area] of expected) {
    const [island] = findIsland(index, n, offset);
    assert.ok(island, `island ${JSON.stringify(n)} @ ${offset}`);
    near(island.area, area, 1e-9);
  }
  assertIslandsWound(index);
  assert.deepEqual(chainLengths(index), [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
  assert.deepEqual(index.box, { min: v(0, 0, 0), max: v(4, 2, 3) });
  assert.match(index.hash, /^12-/);
  // Every edge borders its two outward faces: the top-front edge is
  // {+z, -y}.
  for (const chain of index.chains) assert.equal(chain.sides.length, 2);
  const topFront = index.chains.find((c) =>
    c.points.every((p) => Math.abs(p.z - 3) < 1e-9 && Math.abs(p.y) < 1e-9)
  );
  assert.ok(topFront.sides.some((n) => n.z > 0.999));
  assert.ok(topFront.sides.some((n) => n.y < -0.999));
});

test("thin open quad (thin wall / sheet): open, one deterministic island", () => {
  const front = [v(0, 0, 0), v(4, 0, 0), v(4, 0, 2.5), v(0, 0, 2.5)];
  const a = buildHostPartIndex({ triangles: quadTriangles(...front) });
  const b = buildHostPartIndex({
    triangles: quadTriangles(...[...front].reverse()),
  });
  for (const index of [a, b]) {
    assert.equal(index.isClosed, false);
    assert.equal(index.islands.length, 1);
    // No z component: +y first.
    nearV(index.islands[0].normal, Y);
    near(index.islands[0].area, 10);
    assert.deepEqual(chainLengths(index), [2.5, 2.5, 4, 4]);
  }
  assertIslandsWound(a);
  // Border edges border one facet.
  for (const chain of a.chains) assert.equal(chain.sides.length, 1);
  // A horizontal sheet faces +z.
  const flat = buildHostPartIndex({
    triangles: quadTriangles(v(0, 0, 1), v(0, 2, 1), v(3, 2, 1), v(3, 0, 1)),
  });
  nearV(flat.islands[0].normal, Z);
});

test("wall with a door (carved outline): jambs and head face the opening", () => {
  const index = buildHostPartIndex({
    triangles: wallTriangles({ door: { x0: 2, x1: 3, h: 2.1 } }),
  });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, 10);
  const [front] = findIsland(index, neg(Y), 0);
  const [back] = findIsland(index, Y, 0.2);
  // ExtrudeGeometry stores float32 positions.
  near(front.area, 5 * 2.5 - 2.1, 1e-6);
  near(back.area, 5 * 2.5 - 2.1, 1e-6);
  assert.equal(front.polygons[0].contour.length, 8);
  assert.equal(findIsland(index, X, 2).length, 1); // jamb at x = 2 faces +x
  assert.equal(findIsland(index, neg(X), -3).length, 1); // jamb at x = 3
  assert.equal(findIsland(index, neg(Z), -2.1).length, 1); // door head
  assert.equal(findIsland(index, neg(Z), 0).length, 2); // bottom, 2 pieces
  assertIslandsWound(index);
  // 8 outline edges per side + 8 through the thickness.
  assert.equal(index.chains.length, 24);
});

test("wall with a window: parement island with a hole", () => {
  const index = buildHostPartIndex({
    triangles: wallTriangles({ window: { x0: 1, x1: 2, z0: 1, z1: 2 } }),
  });
  assert.equal(index.isClosed, true);
  const [front] = findIsland(index, neg(Y), 0);
  assert.equal(front.polygons.length, 1);
  assert.equal(front.polygons[0].holes.length, 1);
  near(front.area, 12.5 - 1, 1e-9);
  assert.equal(findIsland(index, Z, 1).length, 1); // sill faces up
  assert.equal(findIsland(index, neg(Z), -2).length, 1); // window head
  assertIslandsWound(index);
});

test("float32 soup far from the origin (CSG output)", () => {
  const soup = wallTriangles({ window: { x0: 1, x1: 2, z0: 1, z1: 2 } });
  const far = new Float32Array(soup.length);
  for (let i = 0; i < soup.length; i += 3) {
    far[i] = soup[i] + 37.3;
    far[i + 1] = soup[i + 1] - 21.7;
    far[i + 2] = soup[i + 2] + 12.1;
  }
  const index = buildHostPartIndex({ triangles: far });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, 10);
  const [front] = findIsland(index, neg(Y), 21.7, 1e-4);
  near(front.area, 11.5, 1e-4);
});

// Box whose top-front edge carries a T-junction (front triangles meet at M,
// the top keeps the whole edge) and whose top has a coplanar T-junction on
// its diagonal — CSG-carved geometry looks like this.
function tJunctionBox({ needle = false, noisySliver = false } = {}) {
  const A = v(0, 0, 0);
  const B = v(4, 0, 0);
  const C = v(4, 0, 3);
  const D = v(0, 0, 3);
  const M = v(2, 0, 3);
  const E = v(4, 2, 3);
  const F = v(0, 2, 3);
  const G = v(2, 1, 3); // middle of the top diagonal D-E
  const soup = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  // Drop the box's own front (triangles 4, 5) and top (2, 3) faces.
  const keep = [];
  for (let t = 0; t < soup.length / 9; t++) {
    if (t >= 2 && t <= 5) continue;
    keep.push(...soup.slice(9 * t, 9 * t + 9));
  }
  const tri = (a, b, c) =>
    keep.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // Front (y = 0, outward -y), fan through M.
  if (noisySliver) {
    // A sliver 0.5 mm high under the top edge, its apex 30 µm off the plane:
    // its own normal is ~3° off, it must still join the front plane.
    const S = v(2, 3e-5, 3 - 5e-4);
    tri(A, B, S);
    tri(B, C, S);
    tri(C, M, S);
    tri(M, D, S);
    tri(D, A, S);
  } else {
    tri(A, B, M);
    tri(B, C, M);
    tri(A, M, D);
  }
  // Top (z = 3, outward +z): whole edge D-C, T-junction on D-E.
  tri(D, C, E);
  tri(D, G, F);
  tri(G, E, F);
  if (needle) tri(D, M, C);
  return keep;
}

test("CSG-like T-junctions: closed, clean islands, straight edges merged", () => {
  for (const options of [{}, { needle: true }, { noisySliver: true }]) {
    const index = buildHostPartIndex({ triangles: tJunctionBox(options) });
    assert.equal(index.isClosed, true, JSON.stringify(options));
    assert.equal(index.islands.length, 6, JSON.stringify(options));
    const [top] = findIsland(index, Z, 3);
    near(top.area, 8, 1e-9);
    assert.equal(top.polygons[0].contour.length, 4);
    const [front] = findIsland(index, neg(Y), 0, 1e-4);
    near(front.area, 12, 1e-6);
    assert.equal(front.polygons[0].contour.length, 4);
    assertIslandsWound(index);
    // The top-front edge is ONE chain, nothing inside the top face.
    assert.deepEqual(chainLengths(index), [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
  }
});

test("face split in two islands (2D cut with a gap)", () => {
  const index = buildHostPartIndex({
    triangles: [
      ...boxTriangles(v(0, 0, 0), v(2, 0.2, 2.5)),
      ...boxTriangles(v(2.01, 0, 0), v(4, 0.2, 2.5)),
    ],
  });
  assert.equal(index.isClosed, true);
  const fronts = findIsland(index, neg(Y), 0);
  assert.equal(fronts.length, 2);
  near(fronts[0].area + fronts[1].area, 2.5 * 3.99, 1e-9);
});

test("abutting pieces: internal partitions cancel out", () => {
  const index = buildHostPartIndex({
    triangles: [
      ...boxTriangles(v(0, 0, 0), v(1, 1, 1)),
      ...boxTriangles(v(1, 0, 0), v(2, 1, 1), { flip: ["left"] }),
    ],
  });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, 6);
  near(findIsland(index, Z, 1)[0].area, 2, 1e-9);
  near(findIsland(index, neg(Y), 0)[0].area, 2, 1e-9);
  assert.equal(findIsland(index, X, 1).length, 0);
  // The outer edges run through the partition vertices.
  assert.equal(chainLengths(index).filter((l) => l === 2).length, 4);
});

test("exactFaces (isMesh3d host): islands = stored faces, oriented outward", () => {
  const triangles = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  const rect = (pts) => pts.map(([x, y, z]) => v(x, y, z));
  const exactFaces = [
    // front split by the user into two coplanar faces, wound inward
    {
      contour: rect([
        [0, 0, 0],
        [0, 0, 3],
        [2, 0, 3],
        [2, 0, 0],
      ]),
      holes: [],
    },
    {
      contour: rect([
        [2, 0, 0],
        [4, 0, 0],
        [4, 0, 3],
        [2, 0, 3],
      ]),
      holes: [],
    },
    {
      contour: rect([
        [0, 0, 3],
        [4, 0, 3],
        [4, 2, 3],
        [0, 2, 3],
      ]),
      holes: [],
    },
  ];
  const index = buildHostPartIndex({ triangles, exactFaces });
  assert.equal(index.isClosed, true);
  assert.equal(index.islands.length, 3);
  assert.equal(findIsland(index, neg(Y), 0).length, 2);
  assert.equal(findIsland(index, Z, 3).length, 1);
  assertIslandsWound(index);
  // No triangles: box from the faces, nothing closed.
  const bare = buildHostPartIndex({ triangles: [], exactFaces });
  assert.equal(bare.isClosed, false);
  assert.deepEqual(bare.box.max, v(4, 2, 3));
  assert.equal(bare.chains.length, 0);
});

test("faceted arc wall: one island per facet, quick", () => {
  // Annulus sector (outer R 5, inner 4.8) extruded 3 m: a curved wall.
  const shape = new Shape();
  shape.absarc(0, 0, 5, 0, Math.PI, false);
  shape.lineTo(-4.8, 0);
  const inner = new Path();
  inner.absarc(0, 0, 4.8, Math.PI, 0, true);
  shape.curves.push(...inner.curves);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: 3,
    bevelEnabled: false,
    curveSegments: 48,
  });
  const triangles = soupOfGeometry(geometry);
  const start = performance.now();
  const index = buildHostPartIndex({ triangles });
  const elapsed = performance.now() - start;
  assert.equal(index.isClosed, true);
  // top + bottom + 2 end caps + 2 × N facets (N = 48 outer, 48 inner)
  assert.ok(index.islands.length >= 2 * 48 + 4, `${index.islands.length}`);
  const caps = findIsland(index, Z, 3);
  assert.equal(caps.length, 1);
  near(caps[0].area, (Math.PI / 2) * (25 - 4.8 * 4.8), 0.01);
  assertIslandsWound(index);
  assert.ok(elapsed < 1000, `${elapsed} ms`);
});

test("dense open sheet stays open (few border edges among many)", () => {
  const soup = [];
  const N = 60;
  const p = (i, j) =>
    v(i * 0.1, j * 0.1, 0.001 * Math.sin(i / 7) * Math.cos(j / 5));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++)
      quadTriangles(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), soup);
  }
  const index = buildHostPartIndex({ triangles: soup });
  assert.equal(index.isClosed, false);
  // A pinhole in a closed box (CSG leftover) is tolerated, a real hole is
  // not, nor a missing face.
  const box = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  const withoutFront = [...box.slice(0, 9 * 4), ...box.slice(9 * 6)];
  const holedFront = (size) =>
    triangulatePaintFace({
      polygons: [
        {
          contour: [v(0, 0, 0), v(4, 0, 0), v(4, 0, 3), v(0, 0, 3)],
          holes: [
            [
              v(1, 0, 1),
              v(1, 0, 1 + size),
              v(1 + size, 0, 1 + size),
              v(1 + size, 0, 1),
            ],
          ],
        },
      ],
      normal: v(0, -1, 0),
    }).positions;
  const pinhole = [...withoutFront, ...holedFront(0.01)];
  assert.equal(buildHostPartIndex({ triangles: pinhole }).isClosed, true);
  const hole = [...withoutFront, ...holedFront(0.05)];
  assert.equal(buildHostPartIndex({ triangles: hole }).isClosed, false);
  assert.equal(
    buildHostPartIndex({ triangles: box.slice(0, 9 * 10) }).isClosed,
    false
  );
});

test("empty input", () => {
  const index = buildHostPartIndex({ triangles: [] });
  assert.deepEqual(index.islands, []);
  assert.deepEqual(index.chains, []);
  assert.equal(index.isClosed, false);
  assert.deepEqual(index.box, { min: v(0, 0, 0), max: v(0, 0, 0) });
  assert.equal(buildHostPartIndex().islands.length, 0);
});

test("thin closed solid (3 mm, inward winding): islands still face outward", () => {
  const all = ["bottom", "top", "front", "back", "left", "right"];
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(4, 1, 0.003), { flip: all }),
  });
  assert.equal(index.isClosed, true);
  const top = index.islands.find((island) => island.centroid.z > 0.002);
  const bottom = index.islands.find((island) => island.centroid.z < 0.001);
  assert.ok(top.normal.z > 0.999, "top faces up");
  assert.ok(bottom.normal.z < -0.999, "bottom faces down");
});

test("probeNormalSide: outward, inward, undetermined", () => {
  const inside = (p) => p.z > 0 && p.z < 0.003;
  assert.equal(probeNormalSide(v(0, 0, 0.003), v(0, 0, 1), inside), 1);
  assert.equal(probeNormalSide(v(0, 0, 0.003), v(0, 0, -1), inside), -1);
  assert.equal(
    probeNormalSide(v(0, 0, 0.003), v(0, 0, 1), () => true),
    0
  );
});
