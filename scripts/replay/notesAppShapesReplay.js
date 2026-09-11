// Node replay of the Krnet shapes / plans pure utils: shape row -> Bimboxa
// annotation + db.points rows (geometry, closeLine, min points, degenerate
// input) and the meterByPx rescaling.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/notesAppShapesReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/notesAppShapesReplay.mjs && node /tmp/notesAppShapesReplay.mjs
//
// Exits 1 on any failure.
/* global process */

import {
  getNotesAppMeterByPx,
  mapNotesAppShapeToAnnotation,
  parseNotesAppShapePoints,
} from "Features/notesApp/utils/mapNotesAppShapeToAnnotation";
import normalizeNotesAppRow from "Features/notesApp/utils/normalizeNotesAppRow";

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

const ctx = {
  listingId: "lst-local",
  baseMapId: "bm-local",
  projectId: "prj",
  scopeId: "scp",
  userIdMaster: "u1",
  updatedAtIso: "2026-09-10T10:00:00.000Z",
  nowIso: "2026-09-11T10:00:00.000Z",
};
const polygonTemplate = {
  id: "tpl-polygon",
  fillColor: "#D93025",
  fillOpacity: 0.8,
  fillType: "SOLID",
  strokeColor: "#D93025",
  strokeWidth: 2,
  strokeOpacity: 1,
};

// --- normalizeNotesAppRow parses the points column
const remotePolygon = normalizeNotesAppRow({
  id: "ann-1",
  base_map_id: "bm-remote",
  listing_id: "lst-remote",
  type: "POLYGON",
  x: 0.31,
  y: 0.42,
  points: '[{"x":0.31,"y":0.42},{"x":0.55,"y":0.42},{"x":0.55,"y":0.61}]',
  close_line: 1,
  fill_color: "#D93025",
  updated_at: 1757500000,
});
check(
  "points parsed",
  Array.isArray(remotePolygon.points) && remotePolygon.points.length === 3
);
check("updatedAt in ms", remotePolygon.updatedAt === 1757500000 * 1000);

// --- POLYGON 3 points
const polygon = mapNotesAppShapeToAnnotation({
  remote: remotePolygon,
  template: polygonTemplate,
  label: "Dalle R+1",
  ...ctx,
});
check("polygon mapped", Boolean(polygon));
check(
  "polygon type/drawingShape",
  polygon.row.type === "POLYGON" && polygon.row.drawingShape === "POLYGON"
);
check("polygon closeLine forced", polygon.row.closeLine === true);
check(
  "polygon cuts empty",
  Array.isArray(polygon.row.cuts) && polygon.row.cuts.length === 0
);
check("polygon 3 point rows", polygon.pointRows.length === 3);
check(
  "point refs match point rows",
  polygon.row.points.every(
    (ref, i) => ref.id === polygon.pointRows[i].id && !("x" in ref)
  )
);
check(
  "points normalized verbatim + scoped",
  polygon.pointRows[1].x === 0.55 &&
    polygon.pointRows[1].y === 0.42 &&
    polygon.pointRows[1].scopeId === "scp" &&
    polygon.pointRows[1].listingId === "lst-local" &&
    polygon.pointRows[1].baseMapId === "bm-local"
);
check(
  "polygon template + style",
  polygon.row.annotationTemplateId === "tpl-polygon" &&
    polygon.row.fillColor === "#D93025"
);
check(
  "polygon label chip",
  polygon.row.label === "Dalle R+1" && polygon.row.showLabel === true
);
check(
  "polygon bookkeeping",
  polygon.row.idMaster === "ann-1" && polygon.row.remoteSource === "notesApp"
);
check(
  "polygon listing = local pair listing",
  polygon.row.listingId === "lst-local" && polygon.row.baseMapId === "bm-local"
);

// --- POLYLINE 2 points, closeLine 0
const polyline = mapNotesAppShapeToAnnotation({
  remote: {
    id: "ann-2",
    type: "POLYLINE",
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.2 },
    ],
    closeLine: 0,
    updatedAt: 1,
  },
  template: { id: "tpl-polyline", strokeColor: "#123456", strokeWidth: 3 },
  label: "",
  ...ctx,
});
check("polyline mapped", Boolean(polyline) && polyline.row.type === "POLYLINE");
check(
  "polyline closeLine false",
  polyline.row.closeLine === false && !("cuts" in polyline.row)
);
check(
  "polyline closeLine 1 -> true",
  mapNotesAppShapeToAnnotation({
    remote: {
      id: "ann-3",
      type: "POLYLINE",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      closeLine: 1,
    },
    ...ctx,
  }).row.closeLine === true
);

// --- update keeps the local id and mints fresh points
const updated = mapNotesAppShapeToAnnotation({
  remote: remotePolygon,
  base: {
    ...polygon.row,
    deletedAt: "x",
    createdAt: "2020-01-01T00:00:00.000Z",
    createdByUserIdMaster: "u0",
  },
  template: polygonTemplate,
  label: "Dalle R+1 bis",
  ...ctx,
});
check("update keeps id", updated.row.id === polygon.row.id);
check(
  "update fresh point ids",
  updated.pointRows.every((p) => !polygon.pointRows.some((q) => q.id === p.id))
);
check(
  "update resurrects + keeps createdAt/creator",
  !("deletedAt" in updated.row) &&
    updated.row.createdAt === "2020-01-01T00:00:00.000Z" &&
    updated.row.createdByUserIdMaster === "u0"
);

// --- degenerate inputs
check(
  "polygon with 2 points skipped",
  mapNotesAppShapeToAnnotation({
    remote: {
      id: "d1",
      type: "POLYGON",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    ...ctx,
  }) === null
);
check(
  "polyline with 1 finite point skipped",
  mapNotesAppShapeToAnnotation({
    remote: {
      id: "d2",
      type: "POLYLINE",
      points: [
        { x: 0, y: 0 },
        { x: "nope", y: 1 },
      ],
    },
    ...ctx,
  }) === null
);
check(
  "MARKER not a shape",
  mapNotesAppShapeToAnnotation({
    remote: { id: "d3", type: "MARKER", points: [{ x: 0, y: 0 }] },
    ...ctx,
  }) === null
);
check(
  "garbage points string",
  parseNotesAppShapePoints("not json").length === 0
);
check(
  "clamp01",
  parseNotesAppShapePoints([{ x: -1, y: 2 }])[0].x === 0 &&
    parseNotesAppShapePoints([{ x: -1, y: 2 }])[0].y === 1
);

// --- meterByPx rescaling
check("scale none", getNotesAppMeterByPx(undefined, 1000) === null);
check(
  "scale raw when widths unknown",
  getNotesAppMeterByPx({ meterByPx: 0.01 }, null) === 0.01
);
check(
  "scale same width",
  getNotesAppMeterByPx({ meterByPx: 0.01, imageWidth: 2000 }, 2000) === 0.01
);
check(
  "scale rescaled",
  Math.abs(
    getNotesAppMeterByPx({ meterByPx: 0.01, imageWidth: 2000 }, 1000) - 0.02
  ) < 1e-12
);
check(
  "scale zero ignored",
  getNotesAppMeterByPx({ meterByPx: 0 }, 1000) === null
);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall good");
