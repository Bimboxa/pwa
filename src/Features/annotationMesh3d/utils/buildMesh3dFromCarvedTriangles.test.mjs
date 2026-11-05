import assert from "node:assert/strict";
import { test } from "node:test";

import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import {
  Brush,
  Evaluator,
  HOLLOW_SUBTRACTION,
  SUBTRACTION,
} from "three-bvh-csg";

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
  return evaluate(SUBTRACTION, host, cutters);
}

// Clip-only boolean of an OPEN sheet host (no cap face of the cutter), like
// the bake of a PX polyline wall.
function clip(host, ...cutters) {
  return evaluate(HOLLOW_SUBTRACTION, host, cutters);
}

function evaluate(operation, host, cutters) {
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  let result = host;
  for (const cutter of cutters) {
    result = evaluator.evaluate(result, cutter, operation);
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

// A PX polyline wall as extrudePolylineWall builds it: one independent
// zero-thickness quad per segment of the profile (x, y), extruded along z.
function sheet(profile, length) {
  const positions = [];
  const indices = [];
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    const v = 4 * i;
    positions.push(
      a.x,
      a.y,
      0,
      b.x,
      b.y,
      0,
      b.x,
      b.y,
      length,
      a.x,
      a.y,
      length
    );
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const brush = new Brush(geometry);
  brush.updateMatrixWorld();
  return brush;
}

// Distance (m) from a point to the profile polyline, in the (x, y) plane:
// how far a vertex of the carved mesh sits from the sheet it was cut from.
function distanceToProfile(p, profile) {
  let best = Infinity;
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const t = Math.min(
      1,
      Math.max(0, ((p.x - a.x) * ex + (p.y - a.y) * ey) / (ex * ex + ey * ey))
    );
    best = Math.min(best, Math.hypot(p.x - a.x - t * ex, p.y - a.y - t * ey));
  }
  return best;
}

test("a clipped sheet stays on the surface it was cut from", () => {
  // Four 1.4 m strips, 40 m long. Strips 0-1 and 2-3 meet at 0.4 degrees
  // (tangent arcs sampled into segments): close to coplanar, yet 1.4 m of
  // width at 0.4 degrees is 10 mm off the neighbour's plane.
  const WIDTH = 1.4;
  const LENGTH = 40;
  const profile = [{ x: OX, y: OY }];
  for (const deg of [0, 0.4, 3, 3.4]) {
    const last = profile[profile.length - 1];
    const rad = (deg * Math.PI) / 180;
    profile.push({
      x: last.x + WIDTH * Math.cos(rad),
      y: last.y + WIDTH * Math.sin(rad),
    });
  }
  const brush = sheet(profile, LENGTH);
  // A slanted block across the whole sheet: every strip is cut in two, along
  // lines that are not aligned with its triangles (slivers in the soup).
  const geometry = new BoxGeometry(12, 4, 4).rotateY(0.3);
  geometry.translate(OX + 2 * WIDTH, OY, 28);
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal")
      geometry.deleteAttribute(name);
  }
  geometry.clearGroups();
  const block = new Brush(geometry);
  block.updateMatrixWorld();

  const mesh = buildMesh3dFromCarvedTriangles({
    positions: clip(brush, block),
  });
  assert.ok(mesh);
  assert.equal(isMesh3dClosed(mesh), false);

  // Every vertex is on the sheet, to a tenth of a millimetre: no face is
  // flattened onto a neighbouring strip's plane, or onto a sliver's.
  const worst = Math.max(
    ...mesh.vertices.map((p) => distanceToProfile(p, profile))
  );
  assert.ok(worst < 1e-4, `a vertex is ${(worst * 1000).toFixed(2)} mm off`);
  // Two pieces per strip: no strips merged, no fragment.
  assert.equal(mesh.faces.length, 8);
});
