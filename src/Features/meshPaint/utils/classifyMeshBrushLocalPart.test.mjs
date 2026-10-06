import assert from "node:assert/strict";
import { test } from "node:test";

import classifyMeshBrushLocalPart, {
  BRUSH_2D_KIND,
  BRUSH_2D_REASON,
  getFaceFootprintSegment,
  isLateralNormal,
} from "./classifyMeshBrushLocalPart.js";

const v = (x, y, z) => ({ x, y, z });
const rect = (z0, z1) => [v(0, 0, z0), v(4, 0, z0), v(4, 0, z1), v(0, 0, z1)];

test("lateral vs horizontal normals", () => {
  assert.ok(isLateralNormal({ x: 0, y: 1, z: 0 }));
  assert.ok(isLateralNormal({ x: 0.7, y: 0.7, z: 0.05 }));
  assert.ok(!isLateralNormal({ x: 0, y: 0, z: 1 }));
  assert.ok(!isLateralNormal({ x: 0.5, y: 0, z: 0.5 }));
  assert.ok(!isLateralNormal(null));
});

test("footprint of a vertical facet = its farthest plan points", () => {
  const seg = getFaceFootprintSegment(rect(0, 2.5));
  assert.deepEqual(seg, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });
  assert.equal(getFaceFootprintSegment([v(1, 1, 0), v(1, 1, 2)]), null);
});

test("lateral facet of a thick wall → WALL_BAND with side normal and top", () => {
  const out = classifyMeshBrushLocalPart(
    "FACE",
    { polygons: [{ contour: rect(0.2, 2.7), holes: [] }], normal: v(0, 2, 0) },
    { isThickWallHost: true }
  );
  assert.equal(out.kind, BRUSH_2D_KIND.WALL_BAND);
  assert.deepEqual(out.sideNormal2d, { x: 0, y: 1 });
  assert.equal(out.topZ, 2.7);
  assert.equal(out.bottomZ, 0.2);
  assert.deepEqual(out.footprint, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });
});

test("top facet of a thick wall, or any facet of another host → FACE_2D", () => {
  const top = {
    polygons: [
      {
        contour: [v(0, 0, 2.5), v(4, 0, 2.5), v(4, 0.2, 2.5), v(0, 0.2, 2.5)],
        holes: [],
      },
    ],
    normal: v(0, 0, 1),
  };
  assert.equal(
    classifyMeshBrushLocalPart("FACE", top, { isThickWallHost: true }).kind,
    BRUSH_2D_KIND.FACE_2D
  );
  const lateral = {
    polygons: [{ contour: rect(0, 2.5), holes: [] }],
    normal: v(0, 1, 0),
  };
  assert.equal(
    classifyMeshBrushLocalPart("FACE", lateral, { isThickWallHost: false })
      .kind,
    BRUSH_2D_KIND.FACE_2D
  );
});

test("curved surfaces and multi-polygon facets keep the paint row", () => {
  const curved = {
    polygons: [{ contour: rect(0, 1), holes: [] }],
    normal: v(0, 1, 0),
    curved: true,
    angleDeg: 30,
  };
  assert.deepEqual(classifyMeshBrushLocalPart("FACE", curved), {
    kind: BRUSH_2D_KIND.PAINT,
    reason: BRUSH_2D_REASON.CURVED,
  });
  const multi = {
    polygons: [
      { contour: rect(0, 1), holes: [] },
      { contour: rect(2, 3), holes: [] },
    ],
    normal: v(0, 1, 0),
  };
  assert.equal(
    classifyMeshBrushLocalPart("FACE", multi, { isThickWallHost: true }).reason,
    BRUSH_2D_REASON.MULTI_POLYGON
  );
  assert.equal(
    classifyMeshBrushLocalPart("FACE", null).reason,
    BRUSH_2D_REASON.NO_GEOMETRY
  );
});

test("edges: flat → POLYLINE_2D (closed curve detected), sloped / vertical → PAINT", () => {
  assert.deepEqual(
    classifyMeshBrushLocalPart("EDGE", {
      points: [v(0, 0, 2), v(4, 0, 2.003)],
    }),
    { kind: BRUSH_2D_KIND.POLYLINE_2D, closeLine: false }
  );
  const square = [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1), v(0, 0, 1)];
  assert.deepEqual(classifyMeshBrushLocalPart("EDGE", { points: square }), {
    kind: BRUSH_2D_KIND.POLYLINE_2D,
    closeLine: true,
  });
  assert.equal(
    classifyMeshBrushLocalPart("EDGE", { points: [v(0, 0, 0), v(4, 0, 1)] })
      .reason,
    BRUSH_2D_REASON.SLOPED_EDGE
  );
  assert.equal(
    classifyMeshBrushLocalPart("EDGE", { points: [v(0, 0, 0), v(0, 0, 2.5)] })
      .reason,
    BRUSH_2D_REASON.SLOPED_EDGE
  );
  assert.equal(
    classifyMeshBrushLocalPart("EDGE", { points: [v(0, 0, 0)] }).reason,
    BRUSH_2D_REASON.NO_GEOMETRY
  );
});
