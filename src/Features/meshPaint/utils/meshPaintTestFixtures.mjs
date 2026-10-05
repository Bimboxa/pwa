// Shared fixtures of the meshPaint utils node tests (not a test file itself:
// `node --test src/Features/meshPaint/utils/*.test.mjs` only picks
// *.test.mjs). Triangle soups are base-map-LOCAL meters, 9 numbers per
// triangle, like the three adapter of the integration produces them.
import assert from "node:assert/strict";

import { ExtrudeGeometry, Path, Shape } from "three";

export const v = (x, y, z) => ({ x, y, z });

export const near = (actual, expected, eps = 1e-9, message = "") =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `${message} expected ${expected}, got ${actual}`
  );

export const nearV = (actual, expected, eps = 1e-9) => {
  near(actual.x, expected.x, eps, "x:");
  near(actual.y, expected.y, eps, "y:");
  near(actual.z, expected.z, eps, "z:");
};

// Non-square reference image, 1 cm per pixel: local x ∈ [-10, 10],
// y ∈ [-5, 5].
export const METRICS = { imageWidth: 2000, imageHeight: 1000, meterByPx: 0.01 };

const pushTri = (out, a, b, c) =>
  out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

// Quad a-b-c-d as two triangles (a, b, c) + (a, c, d).
export function quadTriangles(a, b, c, d, out = []) {
  pushTri(out, a, b, c);
  pushTri(out, a, c, d);
  return out;
}

// Axis-aligned box; faces wound OUTWARD unless listed in `flip` (faces:
// "bottom", "top", "front" (y min), "back" (y max), "left" (x min), "right"
// (x max)) — builders do not guarantee a consistent winding.
export function boxTriangles(min, max, { flip = [], out = [] } = {}) {
  const [x0, y0, z0] = [min.x, min.y, min.z];
  const [x1, y1, z1] = [max.x, max.y, max.z];
  const faces = {
    bottom: [v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0)],
    top: [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)],
    front: [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)],
    back: [v(x1, y1, z0), v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1)],
    left: [v(x0, y1, z0), v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1)],
    right: [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)],
  };
  for (const [name, quad] of Object.entries(faces)) {
    const loop = flip.includes(name) ? [...quad].reverse() : quad;
    quadTriangles(...loop, out);
  }
  return out;
}

// Flat soup of a three.js BufferGeometry, every vertex through `map`.
export function soupOfGeometry(geometry, map = (p) => p) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const out = [];
  for (let i = 0; i < count; i++) {
    const vi = index ? index.getX(i) : i;
    const p = map(v(position.getX(vi), position.getY(vi), position.getZ(vi)));
    out.push(p.x, p.y, p.z);
  }
  return out;
}

// Wall elevation (x along the wall, z up) with optional notches (doors) and
// holes (windows), extruded through the thickness along +y — the way a CSG
// carve leaves a wall: outline in the (x, z) plane, thickness along y. The
// (sx, sy, depth) → (x, y, z) = (sx, depth, sy) swap is a mirror: three's
// winding comes out inverted, like the pixel → local Y flip of the builders.
export function wallTriangles({
  length = 5,
  height = 2.5,
  thickness = 0.2,
  door = null, // {x0, x1, h}
  window: win = null, // {x0, x1, z0, z1}
  y0 = 0,
} = {}) {
  const outline = door
    ? [
        [0, 0],
        [door.x0, 0],
        [door.x0, door.h],
        [door.x1, door.h],
        [door.x1, 0],
        [length, 0],
        [length, height],
        [0, height],
      ]
    : [
        [0, 0],
        [length, 0],
        [length, height],
        [0, height],
      ];
  const shape = new Shape();
  shape.moveTo(...outline[0]);
  for (const point of outline.slice(1)) shape.lineTo(...point);
  shape.closePath();
  if (win) {
    const hole = new Path();
    hole.moveTo(win.x0, win.z0);
    hole.lineTo(win.x0, win.z1);
    hole.lineTo(win.x1, win.z1);
    hole.lineTo(win.x1, win.z0);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  return soupOfGeometry(geometry, (p) => v(p.x, p.z + y0, p.y));
}

// Signed plane offset of every vertex of a part along n (for asserts).
export const offsetsAlong = (points, n) =>
  points.map((p) => p.x * n.x + p.y * n.y + p.z * n.z);

// Island lookup by (approximate) outward normal and plane offset.
export function findIsland(index, normal, offset, tol = 1e-6) {
  return index.islands.filter(
    (island) =>
      island.normal.x * normal.x +
        island.normal.y * normal.y +
        island.normal.z * normal.z >
        0.9999 &&
      Math.abs(
        island.centroid.x * normal.x +
          island.centroid.y * normal.y +
          island.centroid.z * normal.z -
          offset
      ) <= tol
  );
}

// Stored FACE geometry of an axis-aligned rectangle (local corners → P).
export function storedFace(corners, normal, metrics = METRICS, holes = []) {
  const toP = (p) => [
    (p.x / metrics.meterByPx + metrics.imageWidth / 2) / metrics.imageWidth,
    (-p.y / metrics.meterByPx + metrics.imageHeight / 2) / metrics.imageHeight,
    p.z,
  ];
  return {
    polygons: [
      { contour: corners.map(toP), holes: holes.map((h) => h.map(toP)) },
    ],
    normal: [normal.x, normal.y, normal.z],
  };
}

export function storedEdge(a, b, metrics = METRICS) {
  const toP = (p) => [
    (p.x / metrics.meterByPx + metrics.imageWidth / 2) / metrics.imageWidth,
    (-p.y / metrics.meterByPx + metrics.imageHeight / 2) / metrics.imageHeight,
    p.z,
  ];
  return { points: [toP(a), toP(b)] };
}

// Vertical cylinder wall (axis z through the origin) as planar quads, from
// angle `from` over `sweep` radians — outward winding. `caps`: closed solid
// (full turn only). A partial sweep is an open curved sheet.
export function cylinderTriangles({
  radius = 2,
  z0 = 0,
  z1 = 3,
  segments = 32,
  from = 0,
  sweep = 2 * Math.PI,
  caps = false,
  out = [],
} = {}) {
  const at = (i, z) => {
    const angle = from + (sweep * i) / segments;
    return v(radius * Math.cos(angle), radius * Math.sin(angle), z);
  };
  for (let i = 0; i < segments; i++) {
    quadTriangles(at(i, z0), at(i + 1, z0), at(i + 1, z1), at(i, z1), out);
  }
  if (caps) {
    for (let i = 0; i < segments; i++) {
      pushTri(out, v(0, 0, z1), at(i, z1), at(i + 1, z1));
      pushTri(out, v(0, 0, z0), at(i + 1, z0), at(i, z0));
    }
  }
  return out;
}
