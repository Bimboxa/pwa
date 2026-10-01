import test from "node:test";
import assert from "node:assert/strict";
import prepareDxf from "./prepareDxf.js";
import { getDxfFrame, dxfPointToPixel } from "./dxfFrame.js";
import buildDxfRecords from "./buildDxfRecords.js";
import isDxfAnnotationVisible from "./isDxfAnnotationVisible.js";

const entity = (type, pairs) => [0, type, ...pairs];
const line = (pairs = []) =>
  entity("LINE", [10, 0, 20, 0, 11, 10, 21, 5, ...pairs]);
const file = (entities, { blocks = [], tables = [], unit = 6 } = {}) =>
  [
    0,
    "SECTION",
    2,
    "HEADER",
    9,
    "$INSUNITS",
    70,
    unit,
    0,
    "ENDSEC",
    ...(tables.length
      ? [0, "SECTION", 2, "TABLES", ...tables, 0, "ENDSEC"]
      : []),
    ...(blocks.length
      ? [0, "SECTION", 2, "BLOCKS", ...blocks, 0, "ENDSEC"]
      : []),
    0,
    "SECTION",
    2,
    "ENTITIES",
    ...entities,
    0,
    "ENDSEC",
    0,
    "EOF",
    "",
  ].join("\n");
const approx = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("detects units, negative CAD origins, layers and initial visibility", () => {
  const tables = [
    0,
    "TABLE",
    2,
    "LAYER",
    70,
    2,
    0,
    "LAYER",
    2,
    "Walls",
    62,
    1,
    70,
    0,
    0,
    "LAYER",
    2,
    "Hidden",
    62,
    -3,
    70,
    0,
    0,
    "ENDTAB",
  ];
  const drawing = prepareDxf(
    file([...line([8, "Walls"]), ...line([8, "Hidden"])], { tables, unit: 4 })
  );
  assert.equal(drawing.unitCode, 4);
  assert.equal(
    drawing.layers.find((layer) => layer.name === "Hidden").visible,
    false
  );
  assert.equal(drawing.objects[0].color, "#ff0000");
  assert.equal(drawing.objects[1].color, "#00ff00");
  const frame = getDxfFrame({ minX: -20, minY: -5, maxX: -10, maxY: 0 });
  const a = dxfPointToPixel({ x: -20, y: -5 }, frame);
  const b = dxfPointToPixel({ x: -10, y: 0 }, frame);
  assert.ok(b.x > a.x && b.y < a.y);
  approx((b.x - a.x) / frame.scale, 10);
});

test("expands rotated, scaled blocks about their base point, with inherited layer/color", () => {
  const blocks = [
    0,
    "BLOCK",
    2,
    "Door",
    10,
    2,
    20,
    3,
    ...entity("LINE", [8, "0", 62, 0, 10, 2, 20, 3, 11, 3, 21, 3]),
    0,
    "ENDBLK",
  ];
  const drawing = prepareDxf(
    file(
      entity("INSERT", [
        2,
        "Door",
        8,
        "Doors",
        62,
        1,
        10,
        10,
        20,
        20,
        41,
        2,
        42,
        3,
        50,
        90,
      ]),
      { blocks }
    )
  );
  const [a, b] = drawing.objects[0].points;
  approx(a.x, 10);
  approx(a.y, 20);
  approx(b.x, 10);
  approx(b.y, 22);
  assert.equal(drawing.objects[0].layer, "Doors");
  assert.equal(drawing.objects[0].color, "#ff0000");
});

test("nested block transforms compose and arrays preserve unscaled spacing", () => {
  const blocks = [
    0,
    "BLOCK",
    2,
    "Inner",
    10,
    0,
    20,
    0,
    ...line(),
    0,
    "ENDBLK",
    0,
    "BLOCK",
    2,
    "Outer",
    10,
    0,
    20,
    0,
    ...entity("INSERT", [2, "Inner", 10, 3, 20, 0, 41, -1]),
    0,
    "ENDBLK",
  ];
  const drawing = prepareDxf(
    file(entity("INSERT", [2, "Outer", 10, 20, 20, 10, 41, 2, 70, 2, 44, 50]), {
      blocks,
    })
  );
  approx(drawing.objects[0].points[0].x, 26);
  approx(drawing.objects[0].points[1].x, 6);
  approx(drawing.objects[1].points[0].x, 76);
});

test("closed polylines retain bulges and do not turn into filled polygons", () => {
  const drawing = prepareDxf(
    file(
      entity("LWPOLYLINE", [90, 2, 70, 1, 10, 0, 20, 0, 42, 1, 10, 10, 20, 0])
    )
  );
  assert.equal(drawing.objects[0].closed, true);
  assert.ok(drawing.objects[0].points.some((p) => p.y < -4.99));
  assert.equal(drawing.curvedCount, 1);
});

test("arcs crossing zero degrees and circles retain their extents", () => {
  const drawing = prepareDxf(
    file([
      ...entity("ARC", [10, 0, 20, 0, 40, 10, 50, 350, 51, 10]),
      ...entity("CIRCLE", [10, 30, 20, 0, 40, 5]),
    ])
  );
  assert.ok(drawing.objects[0].points.every((p) => p.x > 9.8));
  approx(drawing.bounds.maxX, 35);
  assert.equal(drawing.objects[1].closed, true);
});

test("reports unsupported entities inside blocks and ignores paper space", () => {
  const blocks = [
    0,
    "BLOCK",
    2,
    "Block",
    10,
    0,
    20,
    0,
    ...entity("REGION", [8, "Regions"]),
    ...entity("LEADER", []),
    0,
    "ENDBLK",
  ];
  const drawing = prepareDxf(
    file(
      [
        ...line(),
        ...line([67, 1]),
        ...entity("INSERT", [2, "Block", 10, 0, 20, 0]),
      ],
      { blocks }
    )
  );
  assert.equal(drawing.objects.length, 1);
  assert.deepEqual(drawing.skipped, {
    "Espace papier": 1,
    REGION: 1,
    LEADER: 1,
  });
});

test("rejects inverted normals rather than silently mirroring the geometry", () => {
  const drawing = prepareDxf(
    file([
      ...line(),
      ...entity("CIRCLE", [
        5,
        "C1",
        10,
        0,
        20,
        0,
        40,
        5,
        210,
        0,
        220,
        0,
        230,
        -1,
      ]),
    ])
  );
  assert.equal(drawing.objects.length, 1);
  assert.equal(drawing.skipped["Plans inclinés / normales inversées"], 1);
});

test("recursive blocks stop with a report", () => {
  const blocks = [
    0,
    "BLOCK",
    2,
    "Loop",
    10,
    0,
    20,
    0,
    ...entity("INSERT", [2, "Loop", 10, 0, 20, 0]),
    0,
    "ENDBLK",
  ];
  const drawing = prepareDxf(
    file([...line(), ...entity("INSERT", [2, "Loop", 10, 0, 20, 0])], {
      blocks,
    })
  );
  assert.equal(drawing.skipped["Blocs absents ou récursifs"], 1);
});

test("rejects binary, truncated, unsupported-only and empty drawings", () => {
  assert.throws(() => prepareDxf("AutoCAD Binary DXF\r\n"), /binaire/);
  assert.throws(
    () => prepareDxf(file(line()).replace(/EOF\s*$/, "")),
    /complet/
  );
  assert.throws(() => prepareDxf(file(entity("HATCH", []))), /HATCH/);
  assert.throws(() => prepareDxf(file([])), /Aucune géométrie/);
  assert.throws(
    () => getDxfFrame({ minX: 0, maxX: 0, minY: 0, maxY: 0 }),
    /vide/
  );
});

test("normalized point records resolve to the raster positions at every resolution", () => {
  const drawing = prepareDxf(file([...line([8, "A"]), ...line([8, "B"])]));
  for (const size of [1200, 2400, 4800]) {
    const frame = getDxfFrame(drawing.bounds, size);
    const records = buildDxfRecords({
      drawing,
      frame,
      baseMapId: "map",
      listingId: "list",
      projectId: "project",
      scopeId: "scope",
      layersMode: "BASE_MAP",
      hiddenLayers: new Set(["B"]),
    });
    assert.equal(records.points.length, 2);
    assert.equal(records.annotations.length, 2);
    assert.equal(records.annotations[0].type, "POLYLINE");
    assert.deepEqual(
      records.annotations[0].points,
      records.annotations[1].points
    );
    assert.equal(
      records.layers.find((layer) => layer.name === "B").dxfInitiallyHidden,
      true
    );
    const pointById = new Map(records.points.map((point) => [point.id, point]));
    records.annotations[0].points.forEach((ref, i) => {
      assert.deepEqual(Object.keys(ref), ["id"]);
      const stored = pointById.get(ref.id),
        pixel = dxfPointToPixel(drawing.objects[0].points[i], frame);
      assert.ok(
        stored.x >= 0 && stored.x <= 1 && stored.y >= 0 && stored.y <= 1
      );
      approx(stored.x * frame.width, pixel.x);
      approx(stored.y * frame.height, pixel.y);
    });
    assert.equal(records.layers[0].baseMapId, "map");
  }
});

test("global layers belong to the scope and keep their DXF provenance", () => {
  const drawing = prepareDxf(file(line()));
  const records = buildDxfRecords({
    drawing,
    frame: getDxfFrame(drawing.bounds),
    baseMapId: "map",
    listingId: "list",
    projectId: "project",
    scopeId: "scope",
    layersMode: "GLOBAL",
    hiddenLayers: new Set(),
  });
  assert.equal(records.layers[0].baseMapId, undefined);
  assert.equal(records.layers[0].scopeId, "scope");
  assert.equal(records.layers[0].dxfBaseMapId, "map");
});

test("reference version hides only the original imported annotations", () => {
  const baseMap = {
    dxf: { listingId: "list", referenceVersionId: "reference" },
    versions: [{ id: "reference", isActive: true }],
  };
  assert.equal(
    isDxfAnnotationVisible({ fromDXF: true, listingId: "list" }, baseMap),
    false
  );
  assert.equal(
    isDxfAnnotationVisible({ fromDXF: true, listingId: "other" }, baseMap),
    true
  );
  assert.equal(isDxfAnnotationVisible({ listingId: "list" }, baseMap), true);
  baseMap.versions[0].id = "editable";
  assert.equal(
    isDxfAnnotationVisible({ fromDXF: true, listingId: "list" }, baseMap),
    true
  );
});
