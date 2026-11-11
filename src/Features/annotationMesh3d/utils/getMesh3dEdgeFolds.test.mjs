import assert from "node:assert/strict";
import { test } from "node:test";

import getMesh3dEdgeFolds from "./getMesh3dEdgeFolds.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} ~ ${expected}`);

// Vertical wall of `count` chords around a circle (open top / bottom): quads
// [bottom i, bottom i+1, top i+1, top i].
function buildRing(count, { flipFace = -1 } = {}) {
  const vertices = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    vertices.push({ x: Math.cos(a), y: Math.sin(a), z: 0 });
    vertices.push({ x: Math.cos(a), y: Math.sin(a), z: 3 });
  }
  const faces = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const loop = [2 * i, 2 * j, 2 * j + 1, 2 * i + 1];
    faces.push({ loop: i === flipFace ? [...loop].reverse() : loop });
  }
  return { vertices, faces };
}

const isVertical = (mesh, e) =>
  mesh.vertices[e.a].x === mesh.vertices[e.b].x &&
  mesh.vertices[e.a].y === mesh.vertices[e.b].y;

test("24-chord wall: every seam folds 15°, the rims are borders", () => {
  const mesh = buildRing(24);
  const edges = getMesh3dEdgeFolds(mesh);
  assert.equal(edges.length, 24 * 3);
  const seams = edges.filter((e) => isVertical(mesh, e));
  assert.equal(seams.length, 24);
  for (const e of seams) near(e.foldDeg, 15);
  for (const e of edges.filter((e) => !isVertical(mesh, e))) {
    assert.equal(e.foldDeg, null);
  }
});

test("a flipped face does not change the fold of its seams", () => {
  const mesh = buildRing(24, { flipFace: 5 });
  const seams = getMesh3dEdgeFolds(mesh).filter((e) => isVertical(mesh, e));
  for (const e of seams) near(e.foldDeg, 15);
});

test("a coplanar split folds 0°, a box corner 90°", () => {
  const mesh = {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 0, z: 1 },
      { x: 2, y: 1, z: 1 },
    ],
    faces: [
      { loop: [0, 1, 4, 5] },
      { loop: [1, 2, 3, 4] },
      { loop: [2, 6, 7, 3] },
    ],
  };
  const edges = getMesh3dEdgeFolds(mesh);
  const fold = (a, b) =>
    edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
      .foldDeg;
  near(fold(1, 4), 0);
  near(fold(2, 3), 90);
  assert.equal(fold(0, 1), null);
});

test("an edge shared with a skipped face is a border", () => {
  const mesh = buildRing(24);
  const edges = getMesh3dEdgeFolds(mesh, { skipFaceIndices: new Set([0]) });
  // The two seams of face 0 now belong to one face each.
  const seams = edges.filter((e) => isVertical(mesh, e));
  assert.equal(seams.filter((e) => e.foldDeg === null).length, 2);
});
