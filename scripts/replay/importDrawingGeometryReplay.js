// Offline integration replay: actual importer + paste service, fake persistence.
// Run: node scripts/replay/importDrawingGeometryReplay.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
let seq = 0;
const nanoid = () => `fresh-${++seq}`;
function load(path, bindings) {
  const code = readFileSync(new URL(path, root), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace("export default function", "return function")
    .replace("export default async function", "return async function");
  return new Function(...Object.keys(bindings), code)(
    ...Object.values(bindings)
  );
}
const build = load("src/Features/importAnnotations/utils/buildImportData.js", {
  nanoid,
  resolveDrawingShapeFromType: (t) => t,
  pickStyle: (o) =>
    o
      ? Object.fromEntries(
          Object.entries(o).filter(([k]) =>
            [
              "height",
              "strokeWidth",
              "strokeWidthUnit",
              "stripOrientation",
            ].includes(k)
          )
        )
      : {},
});
const rows = { points: [], annotations: [], relations: [] };
const table = (key) => ({ bulkAdd: async (items) => rows[key].push(...items) });
let transactionTables;
const db = {
  points: table("points"),
  annotations: table("annotations"),
  relAnnotationOpenings: table("relations"),
  relAnnotationMappingCategory: {
    where: () => ({ anyOf: () => ({ toArray: async () => [] }) }),
  },
  transaction: async (_, tables, fn) => {
    transactionTables = tables;
    await fn();
  },
};
const paste = load(
  "src/Features/mapEditor/services/pasteAnnotationService.js",
  {
    nanoid,
    db,
    scaleAnnotationPxFields: () => {},
    applyPasteTransformToPoints: (ps, from, to) =>
      ps.map((p) => ({ ...p, x: p.x - from.x + to.x, y: p.y - from.y + to.y })),
  }
);
const p = (x, y, type = "square") => ({
  x,
  y,
  type,
  offsetTop: 0.2,
  offsetBottom: 0,
});
const data = {
  image: { width: 1000, height: 500 },
  annotationTemplates: [
    {
      id: "wall",
      type: "STRIP",
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      height: 2.1,
    },
  ],
  annotations: [
    {
      id: "host",
      type: "STRIP",
      annotationTemplateId: "wall",
      closeLine: true,
      points: [p(0.1, 0.1), p(0.2, 0.2, "circle"), p(0.3, 0.1)],
      openings: [
        {
          points: [p(0.15, 0.15), p(0.25, 0.15)],
          width: 1,
          height: 1,
          offsetZ: 0.5,
          hostDistanceM: 1.2,
          hostSegmentIndex: 0,
        },
      ],
    },
    {
      id: "ramp",
      type: "POLYGON",
      points: [p(0.4, 0.4), p(0.5, 0.5), p(0.6, 0.4)],
      cuts: [
        {
          points: [
            p(0.45, 0.4),
            p(0.5, 0.45, "circle"),
            p(0.55, 0.4),
            p(0.5, 0.35, "circle"),
          ],
        },
      ],
      guideLines: [
        {
          points: [p(0.45, 0.45), p(0.5, 0.5, "circle"), p(0.55, 0.45)],
          slopePct: 10,
        },
      ],
    },
  ],
};
const baseMap = {
  id: "bm",
  getImageSize: () => ({ width: 1000, height: 500 }),
  getMeterByPx: () => 0.01,
};
const { clipboard } = build({
  data,
  mainBaseMap: baseMap,
  projectId: "p",
  listingId: "l",
  relativeToBaseMap: true,
  templateIdMap: new Map([["wall", "target-template"]]),
});
clipboard.items.forEach((i) => (i.annotation.relayJobId = "job"));
const placed = await paste({
  pasteClipboard: clipboard,
  pasteTransform: {},
  targetCenter: {
    x: clipboard.sourceCenter.x + 10,
    y: clipboard.sourceCenter.y + 20,
  },
  baseMap,
});
assert.equal(placed.length, 3);
assert.equal(rows.relations.length, 1);
assert.ok(transactionTables.includes(db.relAnnotationOpenings));
const host = placed.find((a) => a.type === "STRIP"),
  opening = placed.find((a) => a.isOpening),
  ramp = placed.find((a) => a.type === "POLYGON"),
  rel = rows.relations[0];
assert.equal(host.closeLine, true);
assert.equal(host.height, 2.1);
assert.equal(opening.relayJobId, "job"); // normal live undo discovers it
assert.equal(rel.hostAnnotationId, host.id);
assert.equal(rel.openingAnnotationId, opening.id);
assert.equal(rel.hostSegmentStartPointId, host.points[0].id);
assert.equal(rel.hostArcControlPointId, host.points[1].id);
assert.equal(rel.hostSegmentEndPointId, host.points[2].id);
assert.equal(rel.hostDistanceM, 1.2);
assert.equal(opening.offsetZ, 0.5);
assert.equal(ramp.cuts[0].points[3].type, "circle");
assert.equal(ramp.guideLines[0].slopePct, 10);
assert.equal(ramp.guideLines[0].points[1].type, "circle");
assert.equal(ramp.points[0].offsetTop, 0.2);
const openingPoint = rows.points.find((p) => p.id === opening.points[0].id);
assert.equal(openingPoint.x, 0.16);
assert.equal(openingPoint.y, 0.19);
assert.ok(
  rows.points.some((p) => p.id === ramp.guideLines[0].points[1].pointId)
);
console.log(
  "Import geometry replay passed: arcs, cuts, closure, opening relations, slopes, translation and undo tagging."
);

const parse = load(
  "src/Features/importAnnotations/utils/parseImportAnnotationsJson.js",
  {
    normalizeAnnotationsDumpJson: () => {
      throw new Error("Unexpected dump");
    },
  }
);
assert.ok(parse(JSON.stringify(data)).ok);
const invalid = structuredClone(data);
invalid.annotations[0].openings[0].hostSegmentIndex = 1;
assert.equal(parse(JSON.stringify(invalid)).ok, false);
invalid.annotations[0].openings[0].hostSegmentIndex = 0;
invalid.annotations[0].openings[0].points[0].x = 2;
assert.equal(parse(JSON.stringify(invalid)).ok, false);
const { buildExistingAnnotations } =
  await import("../../src/Features/chat/utils/buildAutoDetectionContext.js");
const context = buildExistingAnnotations(
  data.annotations.map((a) => ({ ...a, listingId: "l", baseMapId: "bm" })),
  "l",
  "bm"
);
assert.deepEqual(context[0].geometry.openings, data.annotations[0].openings);
assert.deepEqual(
  context[1].geometry.guideLines,
  data.annotations[1].guideLines
);
console.log("Parser rejection and chat example context checks passed.");
