import assert from "node:assert/strict";
import { test } from "node:test";

import getAggregatedAnnotationRows from "./getAggregatedAnnotationRows.js";

const annotation = (id, extra) => ({
  id,
  annotationTemplateId: "tWall",
  annotationTemplateProps: { label: "Voile" },
  type: "POLYLINE",
  listingName: "Structure",
  baseMapName: "RDC",
  baseMapId: "bm1",
  layerName: "Niveau 0",
  layerId: "lay1",
  height: 3,
  qties: { enabled: true, length: 4, surface: 10 },
  ...extra,
});

const paintedPart = (id, extra) => ({
  id,
  annotationTemplateId: "tWall",
  template: { id: "tWall", label: "Voile (tpl)", type: "POLYLINE" },
  listingName: "Finitions",
  baseMapName: "RDC",
  baseMapId: "bm1",
  layerName: "Niveau 0",
  layerId: "lay1",
  partType: "FACE",
  isCounted: true,
  qtiesEnabled: true,
  surface: 5,
  length: 0,
  ...extra,
});

const templateRankById = new Map([
  ["tWall", 0],
  ["tPlaster", 1],
]);

const annotations = [annotation("a1"), annotation("a2")];

const paintedParts = [
  paintedPart("p1"),
  // orphan: listed elsewhere, never exported
  paintedPart("p2", { isCounted: false, surface: 100 }),
  // painted-only template
  paintedPart("p3", {
    annotationTemplateId: "tPlaster",
    template: {
      id: "tPlaster",
      label: "Enduit",
      type: "POLYGON",
      fillColor: "#ff0000",
    },
    surface: 12.4,
    baseMapName: "R+1",
    baseMapId: "bm2",
  }),
];

test("global: painted parts join their template row without touching unit / heights", () => {
  const rows = getAggregatedAnnotationRows({
    annotations,
    paintedParts,
    splitByContext: false,
    templateRankById,
  });
  assert.equal(rows.length, 2);

  const wall = rows[0];
  assert.equal(wall.templateId, "tWall");
  assert.equal(wall.templateLabel, "Voile"); // from the annotations
  assert.equal(wall.unit, 2);
  assert.equal(wall.length, 8);
  assert.equal(wall.surface, 25);
  assert.equal(wall.paintedCount, 1);
  assert.equal(wall.height, 3);
  assert.equal(wall.hasMultipleHeights, false);
  assert.equal(wall.listingName, "Structure, Finitions");

  const plaster = rows[1];
  assert.equal(plaster.templateId, "tPlaster");
  assert.equal(plaster.templateLabel, "Enduit");
  assert.equal(plaster.type, "POLYGON");
  assert.equal(plaster.fillColor, "#ff0000");
  assert.equal(plaster.unit, 0);
  assert.equal(plaster.surface, 12.4);
  assert.equal(plaster.paintedCount, 1);
  assert.equal(plaster.height, null);
  assert.equal(plaster.hasMultipleHeights, false);
  assert.equal(plaster.baseMapName, "R+1");
});

test("split: painted parts get their own …|PAINT row", () => {
  const rows = getAggregatedAnnotationRows({
    annotations,
    paintedParts,
    splitByContext: true,
    templateRankById,
  });
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids, [
    "tWall|lay1|bm1|3.000",
    "tWall|lay1|bm1|PAINT",
    "tPlaster|lay1|bm2|PAINT",
  ]);
  const annotationRow = rows[0];
  assert.equal(annotationRow.unit, 2);
  assert.equal(annotationRow.surface, 20);
  assert.equal(annotationRow.paintedCount, 0);
  const paintRow = rows[1];
  assert.equal(paintRow.unit, 0);
  assert.equal(paintRow.height, null);
  assert.equal(paintRow.surface, 5);
  assert.equal(paintRow.paintedCount, 1);
  assert.equal(paintRow.listingName, "Finitions");
});

test("annotations only: unchanged rows (+ paintedCount 0)", () => {
  const rows = getAggregatedAnnotationRows({
    annotations,
    splitByContext: false,
    templateRankById,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].unit, 2);
  assert.equal(rows[0].surface, 20);
  assert.equal(rows[0].paintedCount, 0);
});

test("no annotations yet: painted parts alone", () => {
  assert.deepEqual(
    getAggregatedAnnotationRows({ annotations: null, splitByContext: false }),
    []
  );
  const rows = getAggregatedAnnotationRows({
    annotations: null,
    paintedParts,
    splitByContext: false,
    templateRankById,
  });
  assert.deepEqual(
    rows.map((r) => [r.templateId, r.unit, r.surface, r.paintedCount]),
    [
      ["tWall", 0, 5, 1],
      ["tPlaster", 0, 12.4, 1],
    ]
  );
  assert.equal(rows[0].templateLabel, "Voile (tpl)");
});

test("paint-only row of a drawingShape-only template carries its shape", () => {
  const rows = getAggregatedAnnotationRows({
    annotations: null,
    paintedParts: [
      paintedPart("p9", {
        annotationTemplateId: "tEnduit",
        template: { id: "tEnduit", label: "Enduit", drawingShape: "POLYGON" },
      }),
    ],
    splitByContext: true,
    templateRankById,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, undefined);
  assert.equal(rows[0].drawingShape, "POLYGON");
});
