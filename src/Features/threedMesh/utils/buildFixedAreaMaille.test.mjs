import assert from "node:assert/strict";
import { test } from "node:test";

import clipRegionByCutLines from "../../threedCutLines/utils/clipRegionByCutLines.js";
import {
  curvedSheet,
  foldedStrip,
  slab,
} from "../../threedCutLines/utils/cutLineFixtures.mjs";
import buildFixedAreaMaille, {
  prepareFixedAreaAtlas,
} from "./buildFixedAreaMaille.js";
import computeFaceArea from "./computeFaceArea.js";
import computeUserAxesFrame from "./computeUserAxesFrame.js";
import {
  multiPolygonArea,
  multiPolygonBounds,
  unionAll,
} from "./polygonBoolean2d.js";
import unfoldPiecesAcrossCreases from "./unfoldPiecesAcrossCreases.js";
import { dot, normalize, sub } from "./vec3Utils.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const v = (x, y, z) => ({ x, y, z });

// World soup { positions, tris } of { a, b, c } fixture triangles.
const soupOf = (triangles) => ({
  positions: triangles.flatMap(({ a, b, c }) => [
    a.x,
    a.y,
    a.z,
    b.x,
    b.y,
    b.z,
    c.x,
    c.y,
    c.z,
  ]),
  tris: triangles.map((_, i) => i),
});

// The scene is Y-up: user X = world X, user Y = world Z, user Z = world Y.
const AXES_Y_UP = [
  { key: "X", dir: v(1, 0, 0) },
  { key: "Y", dir: v(0, 0, 1) },
  { key: "Z", dir: v(0, 1, 0) },
];
// The slab fixture lies in z = 0: Z-up axes for it.
const AXES_Z_UP = [
  { key: "X", dir: v(1, 0, 0) },
  { key: "Y", dir: v(0, 1, 0) },
  { key: "Z", dir: v(0, 0, 1) },
];

// Atlas MultiPolygon of the contour of a piece.
const atlasContour = (piece, node) => {
  const ring = piece.contour.map((p) => {
    const q = node.worldToAtlas(p);
    return [q.x, q.y];
  });
  return [[[...ring, ring[0]]]];
};

test("computeUserAxesFrame: wall and floor follow the user axes", () => {
  const wall = computeUserAxesFrame(v(0, 0, 1), v(0, 0, 0), AXES_Y_UP);
  assert.deepEqual(wall.keys, ["X", "Z"]);
  near(dot(wall.u, v(1, 0, 0)), 1);
  near(dot(wall.v, v(0, 1, 0)), 1);

  // Frame rotated by 30° around the vertical.
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const rotated = [
    { key: "X", dir: v(c, 0, -s) },
    { key: "Y", dir: v(s, 0, c) },
    { key: "Z", dir: v(0, 1, 0) },
  ];
  const floor = computeUserAxesFrame(v(0, 1, 0), v(0, 0, 0), rotated);
  assert.deepEqual(floor.keys, ["X", "Y"]);
  near(Math.abs(dot(floor.u, rotated[0].dir)), 1);
  near(dot(floor.v, rotated[1].dir), 1);
});

test("a folded strip unfolds into squares side by side", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const clip = clipRegionByCutLines({ ...strip, cutLines: [] });
  assert.equal(clip.joins.length, 2);
  for (const join of clip.joins) near(join.hi - join.lo, 1);

  const rootPieceIndex = clip.locate(2, v(0, 0, 0)).pieceIndex;
  const root = clip.pieces[rootPieceIndex];
  const frame = computeUserAxesFrame(root.normal, root.contour[0], AXES_Y_UP);
  const nodes = unfoldPiecesAcrossCreases({
    pieces: clip.pieces,
    joins: clip.joins,
    rootPieceIndex,
    frame,
  });
  assert.equal(nodes.size, 3);

  const n = normalize(root.normal);
  const contours = [];
  for (const node of nodes.values()) {
    const piece = clip.pieces[node.pieceIndex];
    // Every unfolded piece lies in the root plane.
    for (const p of piece.contour) {
      const moved = {
        x:
          node.transform.R[0] * p.x +
          node.transform.R[1] * p.y +
          node.transform.R[2] * p.z +
          node.transform.t.x,
        y:
          node.transform.R[3] * p.x +
          node.transform.R[4] * p.y +
          node.transform.R[5] * p.z +
          node.transform.t.y,
        z:
          node.transform.R[6] * p.x +
          node.transform.R[7] * p.y +
          node.transform.R[8] * p.z +
          node.transform.t.z,
      };
      near(dot(n, sub(moved, root.contour[0])), 0, 1e-9);
    }
    const contour = atlasContour(piece, node);
    near(multiPolygonArea(contour), 1, 1e-9);
    contours.push(contour);
    // toAtlas / fromAtlas are inverse of each other.
    const back = node.fromAtlas(node.toAtlas({ x: 0.3, y: -0.7 }));
    near(back.x, 0.3, 1e-12);
    near(back.y, -0.7, 1e-12);
  }
  // No overlap: the union keeps the whole area, 3 × 1 box.
  const united = unionAll(contours);
  near(multiPolygonArea(united), 3, 1e-6);
  const bounds = multiPolygonBounds(united);
  near(bounds.xMax - bounds.xMin, 3, 1e-6);
  near(bounds.yMax - bounds.yMin, 1, 1e-6);
});

test("a curved sheet unfolds to its developed length", () => {
  const steps = 8;
  const radius = 6;
  const clip = clipRegionByCutLines({
    ...soupOf(curvedSheet({ steps, radius })),
    cutLines: [],
  });
  assert.equal(clip.pieces.length, steps);
  const rootPieceIndex = clip.locate(0, v(5, 5, 0)).pieceIndex;
  const atlas = prepareFixedAreaAtlas({
    pieces: clip.pieces,
    joins: clip.joins,
    rootPieceIndex,
    axesDirs: AXES_Z_UP,
    meshes3d: [],
  });
  assert.equal(atlas.nodes.size, steps);
  const developed = steps * 2 * radius * Math.sin(Math.PI / (4 * steps));
  near(multiPolygonArea(atlas.border), 10 * developed, 1e-5);
  const bounds = multiPolygonBounds(atlas.border);
  const sides = [bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin].sort(
    (a, b) => a - b
  );
  near(sides[0], developed, 1e-5);
  near(sides[1], 10, 1e-5);
});

test("a maille spanning the creases of a strip is a shell of the target area", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const clip = clipRegionByCutLines({ ...strip, cutLines: [] });
  const a = strip.corners[1];
  const b = strip.corners[2];
  const cursor = v(a.x + 0.2 * (b.x - a.x), 0.3, a.z + 0.2 * (b.z - a.z));
  const { pieceIndex, groupIndex } = clip.locate(2, cursor);
  const atlas = prepareFixedAreaAtlas({
    pieces: clip.pieces,
    joins: clip.joins,
    pieceIndices: clip.groups[groupIndex].pieceIndices,
    rootPieceIndex: pieceIndex,
    rootPoint: cursor,
    axesDirs: AXES_Y_UP,
    meshes3d: [],
  });
  const result = buildFixedAreaMaille({
    atlas,
    pieceIndex,
    cursorWorld: cursor,
    targetArea: 2.25,
  });
  assert.ok(result);
  assert.equal(result.fits, true);
  // The strip is 1 m high: a 2.25 × 1 band from the nearest end.
  near(result.placement.height, 1);
  near(result.placement.width, 2.25);
  assert.equal(result.pieces.length, 3);
  near(result.area, 2.25, 1e-6);
  assert.ok(result.meshData.shell);
  near(result.meshData.shell.surface, 2.25, 1e-6);
  assert.equal(result.meshData.shell.boundaries.length, 1);
  // Every lifted vertex lies on the plane of its piece.
  for (const piece of result.pieces) {
    const source = clip.pieces[piece.pieceIndex];
    const n = normalize(source.normal);
    for (const p of piece.contour) {
      near(dot(n, sub(p, source.contour[0])), 0, 1e-9);
    }
  }

  // Hovering another facet of the same group reuses the atlas.
  const other = v(
    strip.corners[2].x + 0.5 * (strip.corners[3].x - strip.corners[2].x),
    0.3,
    strip.corners[2].z + 0.5 * (strip.corners[3].z - strip.corners[2].z)
  );
  const again = buildFixedAreaMaille({
    atlas,
    pieceIndex: clip.locate(4, other).pieceIndex,
    cursorWorld: other,
    targetArea: 0.25,
  });
  near(again.area, 0.25, 1e-6);
  assert.equal(again.pieces.length, 1);
  assert.equal(again.meshData.faces.length, 1);
});

test("existing mailles (faces or shell) and cut lines are borders", () => {
  const soup = soupOf(slab({ size: 10 }));
  const corner = {
    contour: [v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0)],
    holes: [],
    normal: v(0, 0, 1),
  };
  const shellCorner = {
    positions: [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 2, 0],
  };
  const elsewhere = {
    contour: [v(0, 0, 1), v(9, 0, 1), v(9, 9, 1), v(0, 9, 1)],
    holes: [],
    normal: v(0, 0, 1),
  };

  for (const meshes3d of [
    [{ faces: [corner] }, { faces: [elsewhere] }],
    [{ faces: [], shell: shellCorner }],
  ]) {
    const clip = clipRegionByCutLines({ ...soup, cutLines: [] });
    const cursor = v(2.3, 0.4, 0);
    const { pieceIndex } = clip.locate(0, cursor);
    const atlas = prepareFixedAreaAtlas({
      pieces: clip.pieces,
      joins: clip.joins,
      rootPieceIndex: pieceIndex,
      rootPoint: cursor,
      axesDirs: AXES_Z_UP,
      meshes3d,
    });
    near(multiPolygonArea(atlas.border), 96, 1e-6);
    const result = buildFixedAreaMaille({
      atlas,
      pieceIndex,
      cursorWorld: cursor,
      targetArea: 4,
    });
    assert.equal(result.fits, true);
    assert.equal(result.meshData.faces.length, 1);
    const [face] = result.meshData.faces;
    near(computeFaceArea(face), 4, 1e-6);
    const xs = face.contour.map((p) => p.x);
    const ys = face.contour.map((p) => p.y);
    near(Math.min(...xs), 2, 1e-6);
    near(Math.max(...xs), 4, 1e-6);
    near(Math.min(...ys), 0, 1e-6);
    near(Math.max(...ys), 2, 1e-6);
  }

  // A maille covering the whole slab leaves nothing.
  const full = clipRegionByCutLines({ ...soup, cutLines: [] });
  const covered = prepareFixedAreaAtlas({
    pieces: full.pieces,
    joins: full.joins,
    rootPieceIndex: 0,
    axesDirs: AXES_Z_UP,
    meshes3d: [
      {
        faces: [
          {
            contour: [v(0, 0, 0), v(10, 0, 0), v(10, 10, 0), v(0, 10, 0)],
            holes: [],
            normal: v(0, 0, 1),
          },
        ],
      },
    ],
  });
  near(multiPolygonArea(covered.border), 0, 1e-9);
  assert.equal(
    buildFixedAreaMaille({
      atlas: covered,
      pieceIndex: 0,
      cursorWorld: v(5, 5, 0),
      targetArea: 4,
    }),
    null
  );

  // Cut line x = 4: the hovered piece is [0, 4] × [0, 10].
  const cut = clipRegionByCutLines({
    ...soup,
    cutLines: [[v(4, -1, 0), v(4, 11, 0)]],
  });
  const cursor = v(3.8, 5, 0);
  const located = cut.locate(0, cursor);
  const atlas = prepareFixedAreaAtlas({
    pieces: cut.pieces,
    joins: cut.joins,
    pieceIndices: cut.groups[located.groupIndex].pieceIndices,
    rootPieceIndex: located.pieceIndex,
    rootPoint: cursor,
    axesDirs: AXES_Z_UP,
    meshes3d: [],
  });
  const result = buildFixedAreaMaille({
    atlas,
    pieceIndex: located.pieceIndex,
    cursorWorld: cursor,
    targetArea: 4,
  });
  const xs = result.meshData.faces[0].contour.map((p) => p.x);
  near(Math.max(...xs), 4, 1e-6);
  near(Math.min(...xs), 2, 1e-6);
});

test("an opening inside the rectangle becomes a hole, the area is net", () => {
  // 10 × 3 wall in the plane z = 0 (Y up), 1 × 1 window at [1, 2] × [1, 2].
  const wall = {
    contour: [v(0, 0, 0), v(10, 0, 0), v(10, 3, 0), v(0, 3, 0)],
    holes: [[v(1, 1, 0), v(1, 2, 0), v(2, 2, 0), v(2, 1, 0)]],
    normal: v(0, 0, 1),
    facetIndex: 0,
  };
  const cursor = v(0.3, 0.2, 0);
  const atlas = prepareFixedAreaAtlas({
    pieces: [wall],
    joins: [],
    rootPieceIndex: 0,
    rootPoint: cursor,
    axesDirs: AXES_Y_UP,
    meshes3d: [],
  });
  const result = buildFixedAreaMaille({
    atlas,
    pieceIndex: 0,
    cursorWorld: cursor,
    targetArea: 5,
  });
  assert.equal(result.fits, true);
  near(result.placement.width, Math.sqrt(6), 1e-6);
  near(result.area, 5, 1e-6);
  assert.equal(result.meshData.faces.length, 1);
  assert.equal(result.meshData.faces[0].holes.length, 1);
  near(computeFaceArea(result.meshData.faces[0]), 5, 1e-6);

  // A full-height opening crossing the band: two parts on one plane, still
  // polygon faces.
  const door = {
    ...wall,
    holes: [[v(1, 0, 0), v(1, 3, 0), v(2, 3, 0), v(2, 0, 0)]],
  };
  const doorAtlas = prepareFixedAreaAtlas({
    pieces: [door],
    joins: [],
    rootPieceIndex: 0,
    rootPoint: cursor,
    axesDirs: AXES_Y_UP,
    meshes3d: [],
  });
  const split = buildFixedAreaMaille({
    atlas: doorAtlas,
    pieceIndex: 0,
    cursorWorld: cursor,
    targetArea: 12,
  });
  near(split.area, 12, 1e-6);
  near(split.placement.width, 5, 1e-6);
  assert.equal(split.meshData.faces.length, 2);
});
