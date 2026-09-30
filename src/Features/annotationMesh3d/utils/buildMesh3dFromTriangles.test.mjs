import assert from "node:assert/strict";
import { test } from "node:test";

import { ExtrudeGeometry, Shape, ShapeGeometry } from "three";

import buildMesh3dFromTriangles from "./buildMesh3dFromTriangles.js";
import getMesh3dQties, { getMesh3dSignedVolume } from "./getMesh3dQties.js";
import isMesh3dClosed from "./isMesh3dClosed.js";

// Same construction as extrudeClosedShape's fast path (what a thick wall or
// an extruded polygon annotation is built from).
function buildShape(points) {
  const shape = new Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++)
    shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
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

const L = [
  [0, 0],
  [3, 0],
  [3, 0.2],
  [0.2, 0.2],
  [0.2, 3],
  [0, 3],
];

test("an ExtrudeGeometry L wall converts to a closed 12 / 8 mesh", () => {
  const geometry = new ExtrudeGeometry(buildShape(L), {
    depth: 2.5,
    bevelEnabled: false,
  });
  geometry.translate(10, -20, 1.001);
  const mesh = buildMesh3dFromTriangles({ positions: soupOf(geometry) });
  assert.equal(mesh.vertices.length, 12);
  assert.equal(mesh.faces.length, 8);
  assert.ok(isMesh3dClosed(mesh));
  const area = 3 * 0.2 + 2.8 * 0.2;
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - area * 2.5) < 1e-4);
  assert.ok(getMesh3dSignedVolume(mesh) > 0);
});

test("a clockwise outline still converts to a closed mesh", () => {
  const geometry = new ExtrudeGeometry(buildShape([...L].reverse()), {
    depth: 1,
    bevelEnabled: false,
  });
  const mesh = buildMesh3dFromTriangles({ positions: soupOf(geometry) });
  assert.equal(mesh.faces.length, 8);
  assert.ok(isMesh3dClosed(mesh));
});

test("a flat ShapeGeometry converts to a one-face sheet", () => {
  const mesh = buildMesh3dFromTriangles({
    positions: soupOf(new ShapeGeometry(buildShape(L))),
  });
  assert.equal(mesh.faces.length, 1);
  assert.equal(mesh.vertices.length, 6);
  assert.ok(!isMesh3dClosed(mesh));
});
