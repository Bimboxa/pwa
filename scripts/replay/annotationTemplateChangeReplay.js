// Node replay of the annotation template change (toolbar / context menu):
// the `type` written on a template switch (same-family only), the
// read-time heal of rows typed LABEL without their 2-point geometry, and
// the diff-only DB patch (no resolved / derived field written back).
//
// Regression: a POLYGON re-templated with a LABEL template was persisted as
// `type: "LABEL"` with its `points` refs and no targetPoint / labelPoint,
// plus the whole resolved row (pixel points, baseMapName, embedded
// annotationTemplate...). useAnnotationsV2 then threw on
// `annotation.targetPoint.x` and the map editor crashed on every load.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/annotationTemplateChangeReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/annotationTemplateChangeReplay.mjs && node /tmp/annotationTemplateChangeReplay.mjs
//
// Exits 1 on any failure.
/* global process */

import getAnnotationTypeOnTemplateChange from "Features/annotations/utils/getAnnotationTypeOnTemplateChange";
import getEffectiveAnnotationType from "Features/annotations/utils/getEffectiveAnnotationType";
import getAnnotationTemplateChangeUpdates from "Features/annotations/utils/getAnnotationTemplateChangeUpdates";
import {
  getGeometryKindFromType,
  getGeometryKindFromShape,
} from "Features/annotations/constants/drawingShapeConfig";

let failures = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail === undefined ? "" : detail);
  }
}

// --- geometry kinds ---------------------------------------------------------

console.log("geometry kinds");
check(
  "POLYGON / STRIP / RULER are POINTS",
  ["POLYGON", "STRIP", "RULER", "COTE", "LINEAR_LAYOUT"].every(
    (t) => getGeometryKindFromType(t) === "POINTS"
  )
);
check(
  "LABEL / FREE_TEXT are LABEL",
  getGeometryKindFromType("LABEL") === "LABEL" &&
    getGeometryKindFromType("FREE_TEXT") === "LABEL"
);
check(
  "MARKER / POINT / DETAIL are POINT",
  ["MARKER", "POINT", "DETAIL"].every(
    (t) => getGeometryKindFromType(t) === "POINT"
  )
);
check(
  "IMAGE / RECTANGLE / OBJECT_3D are BBOX",
  ["IMAGE", "RECTANGLE", "OBJECT_3D"].every(
    (t) => getGeometryKindFromType(t) === "BBOX"
  )
);
check(
  "shape OPENING → POINTS",
  getGeometryKindFromShape("OPENING") === "POINTS"
);
check("unknown type → null", getGeometryKindFromType(undefined) === null);

// --- type on template change ------------------------------------------------

console.log("type on template change");
const polygon = {
  id: "a1",
  type: "POLYGON",
  drawingShape: "POLYGON",
  points: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
};
const strip = { id: "a2", type: "STRIP", points: [{ id: "p1" }, { id: "p2" }] };
const point = { id: "a3", type: "POINT", point: { id: "p1" } };
const labelTemplate = { id: "t1", drawingShape: "LABEL", label: "CA C 40 - 1" };
const polylineTemplate = { id: "t2", drawingShape: "POLYLINE" };
const polygonTemplate = { id: "t3", drawingShape: "POLYGON" };
const markerTemplate = { id: "t4", drawingShape: "MARKER" };

check(
  "POLYGON → LABEL template keeps POLYGON",
  getAnnotationTypeOnTemplateChange(polygon, labelTemplate) === "POLYGON"
);
check(
  "POLYGON → POLYLINE template becomes POLYLINE",
  getAnnotationTypeOnTemplateChange(polygon, polylineTemplate) === "POLYLINE"
);
check(
  "STRIP → POLYLINE template keeps STRIP",
  getAnnotationTypeOnTemplateChange(strip, polylineTemplate) === "STRIP"
);
check(
  "STRIP → POLYGON template becomes POLYGON",
  getAnnotationTypeOnTemplateChange(strip, polygonTemplate) === "POLYGON"
);
check(
  "POINT → MARKER template becomes MARKER",
  getAnnotationTypeOnTemplateChange(point, markerTemplate) === "MARKER"
);
check(
  "POINT → POLYGON template keeps POINT",
  getAnnotationTypeOnTemplateChange(point, polygonTemplate) === "POINT"
);
check(
  "no template → null",
  getAnnotationTypeOnTemplateChange(polygon, null) === null
);

// --- read-time heal ---------------------------------------------------------

console.log("effective type (read-time heal)");
// The corrupted row of the reported project: LABEL type, POLYGON shape,
// 6 point refs, no targetPoint / labelPoint.
const corrupted = {
  id: "PYBcXZ6P3NUCuc1gYOhx7",
  type: "LABEL",
  drawingShape: "POLYGON",
  annotationTemplateId: "t1",
  points: [1, 2, 3, 4, 5, 6].map((i) => ({
    id: `p${i}`,
    x: i * 100,
    y: i * 100,
  })),
  baseMapName: "Plan d'implantation renforts",
  annotationLabel: "CA C 40 - 1",
  templateLabel: "CA C 40 - 1",
  annotationTemplate: labelTemplate,
  fillColor: "#e85426",
  strokeColor: "#e85426",
};
check(
  "LABEL row with points and POLYGON shape reads as POLYGON",
  getEffectiveAnnotationType(corrupted) === "POLYGON"
);
check(
  "LABEL row with points and no shape: ≥3 points → POLYGON",
  getEffectiveAnnotationType({ type: "LABEL", points: [{}, {}, {}] }) ===
    "POLYGON"
);
check(
  "LABEL row with points and no shape: 2 points → POLYLINE",
  getEffectiveAnnotationType({ type: "LABEL", points: [{}, {}] }) === "POLYLINE"
);
check(
  "genuine LABEL keeps LABEL",
  getEffectiveAnnotationType({
    type: "LABEL",
    targetPoint: { x: 0.1, y: 0.1 },
    labelPoint: { x: 0.2, y: 0.2 },
  }) === "LABEL"
);
check(
  "LABEL without any geometry keeps LABEL (centre fallback in resolver)",
  getEffectiveAnnotationType({ type: "LABEL" }) === "LABEL"
);
check(
  "FREE_TEXT with points reads as its shape",
  getEffectiveAnnotationType({
    type: "FREE_TEXT",
    drawingShape: "POLYLINE",
    points: [{}, {}],
  }) === "POLYLINE"
);
check(
  "non-label types untouched",
  getEffectiveAnnotationType(strip) === "STRIP"
);

// The corrupted row re-templated with a POLYGON template is repaired.
check(
  "corrupted row → POLYGON template writes POLYGON",
  getAnnotationTypeOnTemplateChange(corrupted, polygonTemplate) === "POLYGON"
);
check(
  "corrupted row → LABEL template (again) writes the healed POLYGON",
  getAnnotationTypeOnTemplateChange(corrupted, labelTemplate) === "POLYGON"
);

// --- diff-only DB patch -----------------------------------------------------

console.log("template change updates");
const template = {
  id: "t9",
  label: "Zone renf. type A",
  listingId: "L1",
  drawingShape: "POLYGON",
  fillColor: "#00ff00",
  strokeColor: "#0000ff",
  strokeWidth: 4,
  overrideFields: ["fillColor", "strokeColor"],
};
const updates = getAnnotationTemplateChangeUpdates({
  annotation: corrupted,
  template,
  baseMap: null,
});
check(
  "updates target the row",
  updates.id === corrupted.id && updates.annotationTemplateId === "t9"
);
check(
  "locked fields written",
  updates.fillColor === "#00ff00" && updates.strokeColor === "#0000ff"
);
check("unlocked field NOT written", !("strokeWidth" in updates), updates);
check(
  "resolved points NOT written",
  !("points" in updates),
  Object.keys(updates)
);
check(
  "derived fields NOT written",
  [
    "baseMapName",
    "annotationLabel",
    "annotationTemplate",
    "annotationTemplateProps",
    "drawingShape",
  ].every((k) => !(k in updates)),
  Object.keys(updates)
);
check("type repaired to POLYGON", updates.type === "POLYGON");
check(
  "listing / label / lock set follow the template",
  updates.listingId === "L1" &&
    updates.templateLabel === template.label &&
    eq(updates.overrideFields, template.overrideFields)
);

const same = getAnnotationTemplateChangeUpdates({
  annotation: {
    id: "a",
    type: "POLYGON",
    fillColor: "#00ff00",
    strokeColor: "#0000ff",
  },
  template,
  baseMap: null,
});
check(
  "already-matching fields are not re-written",
  eq(Object.keys(same).sort(), [
    "annotationTemplateId",
    "id",
    "listingId",
    "overrideFields",
    "templateLabel",
  ]),
  Object.keys(same)
);

const sizedTemplate = {
  ...template,
  id: "t10",
  drawingShape: "IMAGE",
  size: { width: 10, height: 10 },
  sizeUnit: "PX",
  overrideFields: ["size"],
};
const bboxOnPolygon = getAnnotationTemplateChangeUpdates({
  annotation: polygon,
  template: sizedTemplate,
  baseMap: null,
});
check(
  "bbox never written on a POINTS-family annotation",
  !("bbox" in bboxOnPolygon),
  Object.keys(bboxOnPolygon)
);
check(
  "POLYGON → IMAGE template: type not written (unchanged)",
  !("type" in bboxOnPolygon)
);

check(
  "no template → null",
  getAnnotationTemplateChangeUpdates({
    annotation: polygon,
    template: null,
  }) === null
);

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
