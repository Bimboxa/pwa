import { test } from "node:test";
import assert from "node:assert/strict";

import parsePromptIaProjectOutput, {
  resolvePdfPath,
} from "./parsePromptIaProjectOutput.js";

const PDF_PATHS = ["pdfs/plans.pdf", "pdfs/Coupes.pdf"];

function makeIds() {
  let n = 0;
  return () => `id_${++n}`;
}

function sample() {
  return {
    version: "1.0",
    coordinateSpace: "image",
    project: { name: " Résidence ", clientRef: "P-001" },
    note: "2 doutes",
    baseMaps: [
      {
        id: "bm_rdc",
        name: "RDC",
        listing: "PLAN",
        source: { file: "pdfs/plans.pdf", pageNumber: 1 },
        blueprintScale: 100,
      },
      {
        id: "bm_coupe",
        name: "Coupe AA",
        listing: "ELEVATION",
        source: {
          file: "coupes.pdf",
          pageNumber: 2,
          rotation: 90,
          bboxInRatio: { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.8 },
        },
      },
    ],
    scopes: [
      {
        id: "sc_1",
        name: "Étanchéité",
        listings: [
          {
            id: "ls_1",
            name: "Relevés",
            annotationTemplates: [
              { id: "tpl_a", type: "POLYGON", label: "Zone" },
            ],
            annotations: [
              {
                id: "a1",
                type: "POLYGON",
                baseMapId: "bm_rdc",
                annotationTemplateId: "tpl_a",
                points: [
                  { x: 0.1, y: 0.1 },
                  { x: 0.2, y: 0.1 },
                  { x: 0.2, y: 0.2 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "sc_2",
        name: "Gros œuvre",
        listings: [
          {
            id: "ls_1",
            name: "Murs",
            annotationTemplates: [{ id: "tpl_a", type: "STRIP", label: "Mur" }],
            annotations: [],
          },
        ],
      },
    ],
  };
}

const parse = (json) =>
  parsePromptIaProjectOutput(json, { pdfPaths: PDF_PATHS, newId: makeIds() });

test("remints every id and rewrites the references", () => {
  const result = parse(sample());
  assert.equal(result.ok, true);
  const { baseMaps, scopes } = result.data;
  const authorIds = ["bm_rdc", "bm_coupe", "sc_1", "ls_1", "tpl_a", "a1"];
  const ids = [
    ...baseMaps.map((b) => b.id),
    ...scopes.map((s) => s.id),
    ...scopes.flatMap((s) => s.listings.map((l) => l.id)),
  ];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(authorIds.includes(id), false);

  const listing = scopes[0].listings[0];
  const annotation = listing.annotations[0];
  assert.equal(annotation.baseMapId, baseMaps[0].id);
  assert.equal(
    annotation.annotationTemplateId,
    listing.annotationTemplates[0].id
  );
  // same author template id in two listings → two distinct rows
  assert.notEqual(
    listing.annotationTemplates[0].id,
    scopes[1].listings[0].annotationTemplates[0].id
  );
});

test("counts what will be created", () => {
  const result = parse(sample());
  assert.deepEqual(result.summary, {
    scopes: 2,
    baseMaps: 2,
    listings: 2,
    templates: 2,
    annotations: 1,
  });
  assert.equal(result.data.project.name, "Résidence");
  assert.equal(result.data.note, "2 doutes");
});

test("resolves the pdf path and keeps the frame", () => {
  const result = parse(sample());
  const [plan, section] = result.data.baseMaps;
  assert.deepEqual(plan.source, {
    file: "pdfs/plans.pdf",
    pageNumber: 1,
    rotation: null,
    bboxInRatio: null,
  });
  assert.equal(section.source.file, "pdfs/Coupes.pdf");
  assert.equal(section.source.rotation, 90);
  assert.equal(section.blueprintScale, null);
});

test("resolvePdfPath refuses an ambiguous file name", () => {
  assert.equal(resolvePdfPath("a.pdf", ["x/a.pdf", "y/a.pdf"]), null);
  assert.equal(resolvePdfPath("./x/A.pdf", ["x/a.pdf", "y/a.pdf"]), "x/a.pdf");
});

test("rejects a pdf missing from the zip", () => {
  const json = sample();
  json.baseMaps[0].source.file = "pdfs/absent.pdf";
  const result = parse(json);
  assert.equal(result.ok, false);
  assert.match(result.error, /introuvable dans le zip/);
});

test("rejects an unknown listing kind", () => {
  const json = sample();
  json.baseMaps[0].listing = "FACADE";
  assert.match(parse(json).error, /listing inconnu/);
});

test("rejects unknown references", () => {
  const unknownBaseMap = sample();
  unknownBaseMap.scopes[0].listings[0].annotations[0].baseMapId = "bm_x";
  assert.match(parse(unknownBaseMap).error, /baseMapId inconnu : bm_x/);

  const unknownTemplate = sample();
  unknownTemplate.scopes[0].listings[0].annotations[0].annotationTemplateId =
    "tpl_x";
  assert.match(
    parse(unknownTemplate).error,
    /annotationTemplateId inconnu : tpl_x/
  );
});

test("rejects duplicate base map ids and unsupported types", () => {
  const duplicate = sample();
  duplicate.baseMaps[1].id = "bm_rdc";
  assert.match(parse(duplicate).error, /en double/);

  const detail = sample();
  detail.scopes[0].listings[0].annotationTemplates[0].type = "DETAIL";
  assert.match(parse(detail).error, /non pris en charge/);
});

test("rejects an invalid frame", () => {
  const bbox = sample();
  bbox.baseMaps[1].source.bboxInRatio = { x1: 0.9, y1: 0.1, x2: 0.2, y2: 0.8 };
  assert.match(parse(bbox).error, /bboxInRatio invalide/);

  const rotation = sample();
  rotation.baseMaps[1].source.rotation = 45;
  assert.match(parse(rotation).error, /rotation/);
});

test("rejects an empty project and an unknown coordinate space", () => {
  assert.match(
    parse({ baseMaps: [], scopes: [] }).error,
    /ni fond de plan ni scope/
  );
  const json = sample();
  json.coordinateSpace = "pixels";
  assert.match(parse(json).error, /coordinateSpace inconnu/);
});
