import assert from "node:assert/strict";
import { test } from "node:test";

import { ExtrudeGeometry, Shape, ShapeGeometry } from "three";

import buildMesh3dFromTriangles from "./buildMesh3dFromTriangles.js";
import getMesh3dQties, { getMesh3dSignedVolume } from "./getMesh3dQties.js";
import isMesh3dClosed from "./isMesh3dClosed.js";
import { getFaceArea, getFaceNormal } from "./mesh3dTopology.js";
import orientMesh3dFaces from "./orientMesh3d.js";

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

// 3 x 1 x 2 box whose front wall (y = 0) carries two break points, at x = 1
// and x = 2: three coplanar quads, like the walls extrudeClosedShape emits
// for a polygon with break points (caps triangulated on the break vertices).
function buildBoxWithBreaks() {
  const positions = [];
  const tri = (a, b, c) => positions.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  // Front wall, one quad per segment.
  for (let x = 0; x < 3; x++) {
    quad([x, 0, 0], [x + 1, 0, 0], [x + 1, 0, 2], [x, 0, 2]);
  }
  quad([3, 1, 0], [0, 1, 0], [0, 1, 2], [3, 1, 2]);
  quad([3, 0, 0], [3, 1, 0], [3, 1, 2], [3, 0, 2]);
  quad([0, 1, 0], [0, 0, 0], [0, 0, 2], [0, 1, 2]);
  const ring = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [0, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = [ring[5], ring[i], ring[i + 1]];
    tri([...a, 2], [...b, 2], [...c, 2]);
    tri([...a, 0], [...c, 0], [...b, 0]);
  }
  const labels = new Array(positions.length / 9).fill(0);
  labels[2] = 1;
  labels[3] = 1;
  return { positions, labels };
}

test("coplanar wall quads merge into one face without labels", () => {
  const { positions } = buildBoxWithBreaks();
  const mesh = buildMesh3dFromTriangles({ positions });
  assert.equal(mesh.faces.length, 6);
  assert.equal(mesh.vertices.length, 8);
  assert.ok(isMesh3dClosed(mesh));
});

test("break labels keep the coplanar wall quads as separate faces", () => {
  const { positions, labels } = buildBoxWithBreaks();
  const mesh = buildMesh3dFromTriangles({ positions, labels });
  // The two label-0 quads are not edge-connected: three wall faces.
  assert.equal(mesh.faces.length, 8);
  assert.equal(mesh.vertices.length, 12);
  assert.ok(isMesh3dClosed(mesh));
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - 6) < 1e-6);

  const front = mesh.faces.filter(
    (face) => getFaceNormal(mesh.vertices, face).y < -0.99
  );
  assert.equal(front.length, 3);
  for (const face of front) {
    assert.equal(face.loop.length, 4);
    assert.ok(Math.abs(getFaceArea(mesh.vertices, face) - 2) < 1e-6);
  }
  // The caps keep the break vertices on their front edge.
  const top = mesh.faces.find(
    (face) => getFaceNormal(mesh.vertices, face).z > 0.99
  );
  assert.equal(top.loop.length, 6);
});

test("walls wound against the caps are re-wound into a closed solid", () => {
  // What triangulateAnnotationGeometry builds from an outline drawn
  // clockwise: caps up / down, every wall triangle flipped.
  const { positions, labels } = buildBoxWithBreaks();
  const WALL_TRIANGLES = 12;
  for (let t = 0; t < WALL_TRIANGLES; t++) {
    const b = positions.slice(9 * t + 3, 9 * t + 6);
    const c = positions.slice(9 * t + 6, 9 * t + 9);
    positions.splice(9 * t + 3, 6, ...c, ...b);
  }
  const mesh = buildMesh3dFromTriangles({ positions, labels });
  assert.equal(mesh.faces.length, 8);
  assert.ok(!isMesh3dClosed(mesh));

  const oriented = orientMesh3dFaces(mesh);
  assert.ok(isMesh3dClosed(oriented));
  assert.ok(Math.abs(getMesh3dQties(oriented).volume - 6) < 1e-6);
});
