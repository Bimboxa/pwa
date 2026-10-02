import assert from "node:assert/strict";
import { test } from "node:test";

import hashTriangles from "./hashTriangles.js";
import { boxTriangles, v } from "./meshPaintTestFixtures.mjs";

const split = (soup) => {
  const tris = [];
  for (let i = 0; i < soup.length; i += 9) tris.push(soup.slice(i, i + 9));
  return tris;
};
const rotateVertices = (tri) => [...tri.slice(3), ...tri.slice(0, 3)];
const reverseWinding = (tri) => [
  ...tri.slice(0, 3),
  ...tri.slice(6, 9),
  ...tri.slice(3, 6),
];

test("hashTriangles: independent of triangle and vertex order (winding too)", () => {
  const soup = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  const reference = hashTriangles(soup);
  const tris = split(soup);
  const shuffled = [...tris]
    .reverse()
    .map((tri, i) => (i % 2 ? rotateVertices(tri) : reverseWinding(tri)));
  assert.equal(hashTriangles(shuffled.flat()), reference);
  assert.equal(hashTriangles(new Float32Array(soup)), reference);
  assert.match(reference, /^12-/);
});

test("hashTriangles: quantized to 0.1 mm", () => {
  const soup = boxTriangles(v(0, 0, 0), v(4, 2, 3));
  const reference = hashTriangles(soup);
  const noisy = soup.map((x) => x + 1e-7);
  assert.equal(hashTriangles(noisy), reference);
  const moved = [...soup];
  moved[2] += 0.001; // one vertex, 1 mm
  assert.notEqual(hashTriangles(moved), reference);
  const higher = boxTriangles(v(0, 0, 0), v(4, 2, 3.01));
  assert.notEqual(hashTriangles(higher), reference);
  assert.notEqual(hashTriangles(soup.slice(0, 9 * 11)), reference);
  assert.equal(hashTriangles([]), hashTriangles(null));
});
