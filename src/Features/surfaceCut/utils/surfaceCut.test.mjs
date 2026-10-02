import assert from "node:assert/strict";
import { test } from "node:test";

import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import {
  getFaceLoops,
  getLoopAreaVector,
} from "../../annotationMesh3d/utils/mesh3dTopology.js";

import getPathChunksInRegion, {
  signedArea2d,
} from "./getPathChunksInRegion.js";
import splitFlatRegionAlongChunks from "./splitFlatRegionAlongChunks.js";
import splitMesh3dAlongVerticalPath from "./splitMesh3dAlongVerticalPath.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const p = (x, y) => ({ x, y });
const v = (x, y, z) => ({ x, y, z });

const rect = (x0, y0, x1, y1) => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];

// Net area of a flat face of splitFlatRegionAlongChunks.
function faceArea(vertices, face) {
  return getFaceLoops(face).reduce(
    (sum, loop) => sum + signedArea2d(loop.map((i) => vertices[i])),
    0
  );
}

function split(loops, path, options) {
  const { chunks, error } = getPathChunksInRegion(loops, path, {
    tolerance: 1e-3,
    ...options,
  });
  if (error) return { error };
  return splitFlatRegionAlongChunks(loops, chunks);
}

// Axis-aligned box [0,w]×[0,l]×[0,h], faces wound CCW seen from outside.
function makeBox(w = 4, l = 2, h = 3) {
  return {
    vertices: [
      v(0, 0, 0),
      v(w, 0, 0),
      v(w, l, 0),
      v(0, l, 0),
      v(0, 0, h),
      v(w, 0, h),
      v(w, l, h),
      v(0, l, h),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] },
      { loop: [4, 5, 6, 7], holes: [] },
      { loop: [0, 1, 5, 4], holes: [] },
      { loop: [1, 2, 6, 5], holes: [] },
      { loop: [2, 3, 7, 6], holes: [] },
      { loop: [3, 0, 4, 7], holes: [] },
    ],
  };
}

function signedVolume(mesh) {
  let sum = 0;
  for (const face of mesh.faces) {
    let av = { x: 0, y: 0, z: 0 };
    for (const loop of getFaceLoops(face)) {
      const a = getLoopAreaVector(mesh.vertices, loop);
      av = { x: av.x + a.x, y: av.y + a.y, z: av.z + a.z };
    }
    const q = mesh.vertices[face.loop[0]];
    sum += q.x * av.x + q.y * av.y + q.z * av.z;
  }
  return sum / 6;
}

// --- plan

test("a segment overshooting a rectangle cuts it in two", () => {
  const loops = [rect(0, 0, 10, 4)];
  const result = split(loops, [p(-1, 2), p(11, 2)]);
  assert.ok(result);
  assert.equal(result.faces.length, 2);
  for (let i = 0; i < 4; i++) assert.deepEqual(result.vertices[i], loops[0][i]);
  const areas = result.faces.map((face) => faceArea(result.vertices, face));
  near(areas[0], 20);
  near(areas[1], 20);
});

test("an end stopping inside is prolonged to the edge (guillotine)", () => {
  const loops = [rect(0, 0, 10, 4)];
  const { chunks } = getPathChunksInRegion(loops, [p(4, 2), p(6, 2)], {
    tolerance: 1e-3,
    extendEnds: true,
  });
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], [p(0, 2), p(10, 2)]);
  const dangling = getPathChunksInRegion(loops, [p(4, 2), p(6, 2)], {
    tolerance: 1e-3,
  });
  assert.equal(dangling.chunks.length, 0);
});

test("a line across a U cuts it in three pieces", () => {
  const loops = [
    [
      p(0, 0),
      p(10, 0),
      p(10, 10),
      p(7, 10),
      p(7, 3),
      p(3, 3),
      p(3, 10),
      p(0, 10),
    ],
  ];
  const result = split(loops, [p(-1, 6), p(11, 6)]);
  assert.ok(result);
  assert.equal(result.faces.length, 3);
  const areas = result.faces
    .map((face) => faceArea(result.vertices, face))
    .sort((a, b) => a - b);
  near(areas[0], 12);
  near(areas[1], 12);
  near(areas[2], 48);
});

test("a line through a hole splits the hole between the pieces", () => {
  const loops = [rect(0, 0, 10, 10), rect(4, 4, 6, 6).reverse()];
  const result = split(loops, [p(-1, 5), p(11, 5)]);
  assert.ok(result);
  assert.equal(result.faces.length, 2);
  for (const face of result.faces) {
    near(faceArea(result.vertices, face), 48);
    assert.equal(face.holes.length, 0);
  }
});

test("a hole the line misses stays in its piece", () => {
  const loops = [rect(0, 0, 10, 10), rect(1, 1, 2, 2).reverse()];
  const result = split(loops, [p(-1, 5), p(11, 5)]);
  assert.ok(result);
  const withHole = result.faces.filter((face) => face.holes.length === 1);
  assert.equal(withHole.length, 1);
  near(faceArea(result.vertices, withHole[0]), 49);
});

test("a polyline through a corner reuses the corner", () => {
  const loops = [rect(0, 0, 10, 4)];
  const result = split(loops, [p(-2, -1), p(4, 2), p(4, 5)]);
  assert.ok(result);
  assert.equal(result.faces.length, 2);
  assert.ok(result.faces.every((face) => face.loop.includes(0)));
});

test("a self-intersecting path is refused", () => {
  const { error } = getPathChunksInRegion(
    [rect(0, 0, 10, 10)],
    [p(-1, 2), p(11, 8), p(11, 2), p(-1, 8)],
    { tolerance: 1e-3 }
  );
  assert.equal(error, "SELF_INTERSECTING");
});

test("a stroke from the contour into a hole does not cut", () => {
  const loops = [rect(0, 0, 10, 10), rect(4, 4, 6, 6).reverse()];
  assert.equal(split(loops, [p(-1, 5), p(5, 5)]), null);
});

// --- mesh guillotine

test("a box cut by a vertical plane gives two closed boxes", () => {
  const box = makeBox();
  const result = splitMesh3dAlongVerticalPath(box, [p(1, -1), p(1, 3)]);
  assert.ok(result.pieces, result.error);
  assert.equal(result.pieces.length, 2);
  assert.ok(result.capped);
  for (const piece of result.pieces) assert.ok(isMesh3dClosed(piece));
  near(signedVolume(result.pieces[0]), 18);
  near(signedVolume(result.pieces[1]), 6);
});

test("a short stroke inside the silhouette cuts through", () => {
  const result = splitMesh3dAlongVerticalPath(makeBox(), [
    p(2, 0.8),
    p(2, 1.2),
  ]);
  assert.equal(result.pieces?.length, 2);
  near(signedVolume(result.pieces[0]), 12);
  near(signedVolume(result.pieces[1]), 12);
});

test("an L-shaped curtain cuts a corner block with two cap faces", () => {
  const result = splitMesh3dAlongVerticalPath(makeBox(), [
    p(2, -1),
    p(2, 1),
    p(5, 1),
  ]);
  assert.ok(result.pieces, result.error);
  assert.equal(result.pieces.length, 2);
  assert.ok(result.capped);
  for (const piece of result.pieces) assert.ok(isMesh3dClosed(piece));
  near(signedVolume(result.pieces[0]), 18);
  near(signedVolume(result.pieces[1]), 6);
});

test("a curtain through two vertical edges reuses them", () => {
  const result = splitMesh3dAlongVerticalPath(makeBox(), [
    p(-1, -0.5),
    p(5, 2.5),
  ]);
  assert.ok(result.pieces, result.error);
  assert.equal(result.pieces.length, 2);
  for (const piece of result.pieces) {
    assert.ok(isMesh3dClosed(piece));
    near(signedVolume(piece), 12);
  }
});

test("a curtain missing the mesh does not cut", () => {
  const result = splitMesh3dAlongVerticalPath(makeBox(), [p(6, -1), p(6, 3)]);
  assert.equal(result.error, "NO_CROSSING");
});

test("an open sheet is cut without caps", () => {
  const sheet = {
    vertices: [v(0, 0, 0), v(4, 0, 0), v(4, 2, 0), v(0, 2, 0)],
    faces: [{ loop: [0, 1, 2, 3], holes: [] }],
  };
  const result = splitMesh3dAlongVerticalPath(sheet, [p(1, -1), p(1, 3)]);
  assert.equal(result.pieces?.length, 2);
  assert.equal(result.capped, false);
});

// Prism of a plan contour (CCW) with holes (CW), from z = 0 to its top
// height, given per plan point.
function extrude(contour, holes = [], top = () => 1) {
  const vertices = [];
  const faces = [];
  const rings = [contour, ...holes].map((ring) =>
    ring.map((q) => {
      vertices.push(v(q.x, q.y, 0));
      vertices.push(v(q.x, q.y, top(q)));
      return { bottom: vertices.length - 2, top: vertices.length - 1 };
    })
  );
  const [outer, ...inner] = rings;
  faces.push({
    loop: outer.map((r) => r.bottom).reverse(),
    holes: inner.map((ring) => ring.map((r) => r.bottom).reverse()),
  });
  faces.push({
    loop: outer.map((r) => r.top),
    holes: inner.map((ring) => ring.map((r) => r.top)),
  });
  for (const ring of rings) {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      faces.push({ loop: [a.bottom, b.bottom, b.top, a.top], holes: [] });
    });
  }
  return { vertices, faces };
}

test("a slab cut through its hole gives two closed U pieces", () => {
  const slab = extrude(rect(0, 0, 4, 4), [rect(1, 1, 3, 3).reverse()]);
  assert.ok(isMesh3dClosed(slab));
  near(signedVolume(slab), 12);
  const result = splitMesh3dAlongVerticalPath(slab, [p(2, -1), p(2, 5)]);
  assert.ok(result.pieces, result.error);
  assert.equal(result.pieces.length, 2);
  assert.ok(result.capped);
  for (const piece of result.pieces) {
    assert.ok(isMesh3dClosed(piece));
    near(signedVolume(piece), 6);
  }
});

test("a sloped top is cut on its plane", () => {
  const wedge = extrude(rect(0, 0, 4, 2), [], (q) => 3 - q.x / 2);
  near(signedVolume(wedge), 16);
  const result = splitMesh3dAlongVerticalPath(wedge, [p(1, -1), p(1, 3)]);
  assert.ok(result.pieces, result.error);
  for (const piece of result.pieces) assert.ok(isMesh3dClosed(piece));
  near(signedVolume(result.pieces[0]), 10.5);
  near(signedVolume(result.pieces[1]), 5.5);
});
