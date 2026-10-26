import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EdgesGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
} from "three";

import buildMesh3dFromTriangles from "../../annotationMesh3d/utils/buildMesh3dFromTriangles.js";
import getMesh3dQties from "../../annotationMesh3d/utils/getMesh3dQties.js";
import isMesh3dClosed from "../../annotationMesh3d/utils/isMesh3dClosed.js";
import getPlanarMeshBoundary from "../../threedEditor/js/utilsAnnotationsManager/getPlanarMeshBoundary.js";
import getHatchFillGeometry from "./getHatchFillGeometry.js";
import splitTJunctions from "./splitTJunctions.js";

// A 10 × 4 polygon with three 1 × 1 holes whose borders share the same y:
// the case where earcut bridges the holes along their bottom edge.
const OUTER = [
  [0, 0],
  [10, 0],
  [10, 4],
  [0, 4],
];
const HOLES = [1, 4, 7].map((x) => [
  [x, 1],
  [x + 1, 1],
  [x + 1, 2],
  [x, 2],
]);

function tracePath(path, points) {
  path.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++)
    path.lineTo(points[i][0], points[i][1]);
  path.closePath();
}

function buildShape(outer, holes = []) {
  const shape = new Shape();
  tracePath(shape, outer);
  for (const hole of holes) {
    const path = new Path();
    tracePath(path, [...hole].reverse());
    shape.holes.push(path);
  }
  return shape;
}

const soupOf = (geometry) => {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const positions = [];
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i++) {
    const vi = index ? index.getX(i) : i;
    positions.push(position.getX(vi), position.getY(vi), position.getZ(vi));
  }
  return positions;
};

const edgeLengths = (geometry, thresholdDeg = 1) => {
  const p = new EdgesGeometry(geometry, thresholdDeg).getAttribute("position");
  const lengths = [];
  for (let i = 0; i < p.count; i += 2) {
    lengths.push(
      Math.hypot(
        p.getX(i + 1) - p.getX(i),
        p.getY(i + 1) - p.getY(i),
        p.getZ(i + 1) - p.getZ(i)
      )
    );
  }
  return lengths;
};

const triangleArea = (geometry) => {
  const s = soupOf(geometry);
  let area = 0;
  for (let i = 0; i < s.length; i += 9) {
    const ux = s[i + 3] - s[i];
    const uy = s[i + 4] - s[i + 1];
    const vx = s[i + 6] - s[i];
    const vy = s[i + 7] - s[i + 1];
    area += Math.abs(ux * vy - uy * vx) / 2;
  }
  return area;
};

test("earcut leaves T-junctions on aligned holes (the bug)", () => {
  const geometry = new ShapeGeometry(buildShape(OUTER, HOLES));
  const { loops } = getPlanarMeshBoundary(geometry);
  assert.ok(loops.length < 4, "holes come back merged into one loop");
  assert.ok(edgeLengths(geometry).some((l) => l > 4.5 && l < 9.5));
});

test("splitTJunctions restores the three holes of a flat ShapeGeometry", () => {
  const before = new ShapeGeometry(buildShape(OUTER, HOLES));
  const geometry = splitTJunctions(before);
  assert.notEqual(geometry, before);
  assert.ok(geometry.getIndex(), "indexed input stays indexed");
  assert.ok(Math.abs(triangleArea(geometry) - 37) < 1e-6);

  const { loops } = getPlanarMeshBoundary(geometry);
  assert.equal(loops.length, 4);
  const holeLoops = loops.filter(
    (loop) => loop.length === 4 && loop.every(([x]) => x > 0.5 && x < 9.5)
  );
  assert.equal(holeLoops.length, 3);

  // Every drawn edge is a real border: 10 / 4 (outer) or 1 (hole side).
  for (const l of edgeLengths(geometry)) {
    assert.ok(
      [1, 4, 10].some((ref) => Math.abs(l - ref) < 1e-6),
      `edge ${l}`
    );
  }

  // The hatch band follows the four borders, with no strip between holes.
  const hatch = getHatchFillGeometry({ loops });
  assert.equal(hatch.bandPolygons.length, 4);
});

test("splitTJunctions keeps an ExtrudeGeometry soup closed with its volume", () => {
  const before = new ExtrudeGeometry(buildShape(OUTER, HOLES), {
    depth: 1,
    bevelEnabled: false,
  });
  const geometry = splitTJunctions(before);
  assert.notEqual(geometry, before);
  assert.equal(geometry.getIndex(), null, "soup input stays a soup");
  assert.equal(geometry.groups.length, before.groups.length);
  const corners = geometry.getAttribute("position").count;
  assert.equal(
    geometry.groups.reduce((sum, g) => sum + g.count, 0),
    corners
  );
  for (const name of Object.keys(before.attributes)) {
    assert.equal(geometry.getAttribute(name).count, corners, name);
  }

  const mesh = buildMesh3dFromTriangles({ positions: soupOf(geometry) });
  assert.ok(isMesh3dClosed(mesh));
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - 37) < 1e-4);

  // No long edge along the hole bottoms on the caps.
  for (const l of edgeLengths(geometry)) {
    assert.ok(
      [1, 4, 10].some((ref) => Math.abs(l - ref) < 1e-6),
      `edge ${l}`
    );
  }
});

test("splitTJunctions returns the same geometry when there is nothing to split", () => {
  const plain = new ShapeGeometry(buildShape(OUTER));
  assert.equal(splitTJunctions(plain), plain);
  const offset = new ShapeGeometry(
    buildShape(OUTER, [
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
      ],
      [
        [4, 2.5],
        [5, 2.5],
        [5, 3.5],
        [4, 3.5],
      ],
    ])
  );
  assert.equal(splitTJunctions(offset), offset);
});
