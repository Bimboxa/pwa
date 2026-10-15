import assert from "node:assert/strict";
import { test } from "node:test";

import { BoxGeometry } from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

import buildMesh3dFromCarvedTriangles from "./buildMesh3dFromCarvedTriangles.js";
import getMesh3dQties, { getMesh3dSignedVolume } from "./getMesh3dQties.js";
import isMesh3dClosed from "./isMesh3dClosed.js";

// Box centered on (cx, cy, cz), stripped to a position-only soup brush like
// subtractAnnotationGeometries' sanitizeGeometry.
function box(w, d, h, cx, cy, cz) {
  const geometry = new BoxGeometry(w, d, h).translate(cx, cy, cz);
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal")
      geometry.deleteAttribute(name);
  }
  geometry.clearGroups();
  const brush = new Brush(geometry);
  brush.updateMatrixWorld();
  return brush;
}

function carve(host, ...cutters) {
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  let result = host;
  for (const cutter of cutters) {
    result = evaluator.evaluate(result, cutter, SUBTRACTION);
  }
  const position = result.geometry.getAttribute("position");
  const index = result.geometry.getIndex();
  const positions = [];
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i++) {
    const vi = index ? index.getX(i) : i;
    positions.push(position.getX(vi), position.getY(vi), position.getZ(vi));
  }
  return positions;
}

// Away from the origin: float32 noise grows with |coord|.
const OX = 37.4;
const OY = -12.8;

test("a slab pierced by a column becomes one closed mesh with a hole", () => {
  const slab = box(4, 4, 0.3, OX, OY, 0.15);
  const column = box(1, 1, 2, OX, OY, 0.5);
  const mesh = buildMesh3dFromCarvedTriangles({
    positions: carve(slab, column),
  });
  assert.ok(mesh);
  assert.ok(isMesh3dClosed(mesh));
  // top + bottom (each with one hole) + 4 outer sides + 4 hole sides.
  assert.equal(mesh.faces.length, 10);
  assert.equal(mesh.faces.filter((f) => f.holes?.length === 1).length, 2);
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - 15 * 0.3) < 1e-3);
  assert.ok(getMesh3dSignedVolume(mesh) > 0);
});

test("a partial notch (stairs into a slab edge) stays closed", () => {
  const slab = box(4, 4, 0.3, OX, OY, 0.15);
  // 1 m wide band along the -x edge, 0.1 m deep from the top.
  const notch = box(1, 6, 0.2, OX - 2, OY, 0.3);
  const mesh = buildMesh3dFromCarvedTriangles({
    positions: carve(slab, notch),
  });
  assert.ok(mesh);
  assert.ok(isMesh3dClosed(mesh));
  const expected = 16 * 0.3 - 0.5 * 4 * 0.1;
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - expected) < 1e-3);
  // L-shaped section extruded along y: 6 lateral faces + 2 ends.
  assert.equal(mesh.faces.length, 8);
});

test("two cutters at once", () => {
  const slab = box(4, 4, 0.3, OX, OY, 0.15);
  const a = box(0.5, 0.5, 2, OX - 1, OY - 1, 0.5);
  const b = box(0.5, 0.5, 2, OX + 1, OY + 1, 0.5);
  const mesh = buildMesh3dFromCarvedTriangles({
    positions: carve(slab, a, b),
  });
  assert.ok(isMesh3dClosed(mesh));
  assert.ok(Math.abs(getMesh3dQties(mesh).volume - (16 - 0.5) * 0.3) < 1e-3);
});
