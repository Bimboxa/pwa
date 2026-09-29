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

const IMAGE_PATHS = ["satellite/site.png"];

const parse = (json) =>
  parsePromptIaProjectOutput(json, {
    pdfPaths: PDF_PATHS,
    imagePaths: IMAGE_PATHS,
    newId: makeIds(),
  });

const PAIRS = [
  { plan: { x: 0.1, y: 0.8 }, reference: { x: 0.4, y: 0.55 } },
  { plan: { x: 0.9, y: 0.2 }, reference: { x: 0.47, y: 0.49 } },
];

function satelliteSite() {
  return {
    address: " 12 rue des Tilleuls, 69003 Lyon ",
    latLng: { lat: 45.7578, lng: 4.8531 },
    reference: {
      type: "SATELLITE",
      file: "site.png",
      crs: "EPSG:3946",
      bbox: [1843000, 5174000, 1843300, 5174300],
      width: 2048,
      height: 2048,
    },
  };
}

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
    placements: 0,
    documents: 0,
    businessObjectListings: 0,
    businessObjects: 0,
    issues: 0,
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

test("keeps the placement of an annotated plan view", () => {
  const json = sample();
  json.site = satelliteSite();
  json.baseMaps[0].placement = { points: PAIRS, altitude: 3 };
  const result = parse(json);
  assert.equal(result.ok, true);
  assert.equal(result.summary.placements, 1);
  assert.deepEqual(result.data.baseMaps[0].placement, {
    points: PAIRS,
    altitude: 3,
  });
  assert.deepEqual(result.data.site, {
    address: "12 rue des Tilleuls, 69003 Lyon",
    latLng: { lat: 45.7578, lng: 4.8531 },
    reference: {
      type: "SATELLITE",
      file: "satellite/site.png",
      crs: "EPSG:3946",
      bbox: { minx: 1843000, miny: 5174000, maxx: 1843300, maxy: 5174300 },
      width: 2048,
      height: 2048,
      layer: null,
    },
  });
  assert.deepEqual(result.data.warnings, []);
});

test("drops the placement of details, elevations and bare plans", () => {
  const detail = sample();
  detail.site = satelliteSite();
  detail.baseMaps[0].isDetail = true;
  detail.baseMaps[0].placement = { points: PAIRS };
  detail.baseMaps[1].placement = { points: PAIRS };
  const result = parse(detail);
  assert.equal(result.ok, true);
  assert.equal(result.summary.placements, 0);
  assert.equal(result.data.baseMaps[0].isDetail, true);
  assert.equal(result.data.warnings.length, 2);
  assert.match(result.data.warnings[0], /détail/);
  assert.match(result.data.warnings[1], /vue en plan/);

  const bare = sample();
  bare.site = satelliteSite();
  bare.baseMaps[0].listing = "PLAN";
  bare.scopes[0].listings[0].annotations = [];
  bare.baseMaps[0].placement = { points: PAIRS };
  assert.match(parse(bare).data.warnings[0], /aucune annotation/);
});

test("uses a base map as the reference, never located itself", () => {
  const json = sample();
  json.baseMaps.push({
    id: "bm_masse",
    name: "Plan masse",
    source: { file: "pdfs/plans.pdf", pageNumber: 2 },
    blueprintScale: 500,
    placement: { points: PAIRS },
  });
  json.site = { reference: { type: "BASE_MAP", baseMapId: "bm_masse" } };
  json.baseMaps[0].placement = { points: PAIRS };
  const result = parse(json);
  const [plan, , masse] = result.data.baseMaps;
  assert.deepEqual(result.data.site.reference, {
    type: "BASE_MAP",
    baseMapId: masse.id,
  });
  assert.equal(masse.placement, null);
  assert.notEqual(plan.placement, null);
  assert.equal(result.summary.placements, 1);
});

test("an unusable reference or placement never fails the import", () => {
  const mercator = sample();
  mercator.site = satelliteSite();
  mercator.site.reference.crs = "EPSG:3857";
  mercator.baseMaps[0].placement = { points: PAIRS };
  const result = parse(mercator);
  assert.equal(result.ok, true);
  assert.equal(result.data.site.reference, null);
  assert.equal(result.data.site.address, "12 rue des Tilleuls, 69003 Lyon");
  assert.equal(result.summary.placements, 0);
  assert.match(result.data.warnings[0], /crs non pris en charge/);

  const onePoint = sample();
  onePoint.site = satelliteSite();
  onePoint.baseMaps[0].placement = { points: [PAIRS[0], { plan: {} }] };
  assert.match(parse(onePoint).data.warnings[0], /points homologues/);

  // the image may be missing from the zip: it is fetched again
  const noFile = sample();
  noFile.site = satelliteSite();
  noFile.site.reference.file = "satellite/absent.png";
  assert.equal(parse(noFile).data.site.reference.file, null);
});

// --- documents, business objects, issues ---

function dpgfSample() {
  const json = sample();
  json.documents = [
    { id: "doc_cctp", name: "CCTP Lot 05", file: "documents/cctp.pdf" },
    { id: "doc_absent", file: "documents/absent.pdf" },
  ];
  json.scopes[0].businessObjectListings = [
    {
      id: "bo_dpgf",
      name: "DPGF Lot 05",
      businessObjects: [
        {
          id: "o1",
          parentId: null,
          code: "4.",
          label: "Ouvrages",
          isTitle: true,
        },
        {
          id: "o2",
          parentId: "o1",
          code: "4.1.",
          label: "Étanchéité terrasse",
          unit: "M²",
          refQty: 404,
          annotationIds: ["a1", "a1", "inconnue"],
          documentLinks: [
            {
              documentId: "doc_cctp",
              pageNumber: 12,
              title: " 4.1  Étanchéité ",
            },
            { documentId: "doc_absent", pageNumber: 3 },
          ],
        },
      ],
    },
  ];
  json.scopes[0].issues = [
    {
      id: "i1",
      label: "Échelle douteuse",
      description: "Cartouche illisible.",
      annotationIds: ["a1"],
      businessObjectIds: ["o2", "o9"],
      documentLinks: [{ documentId: "doc_cctp" }],
    },
    { description: "sans libellé" },
  ];
  return json;
}

const parseDpgf = (json) =>
  parsePromptIaProjectOutput(json, {
    pdfPaths: PDF_PATHS,
    filePaths: [...PDF_PATHS, "documents/cctp.pdf"],
    newId: makeIds(),
  });

test("parses the documents and drops the ones missing from the zip", () => {
  const result = parseDpgf(dpgfSample());
  assert.equal(result.ok, true);
  assert.equal(result.data.documents.length, 1);
  assert.equal(result.data.documents[0].file, "documents/cctp.pdf");
  assert.equal(result.data.documents[0].name, "CCTP Lot 05");
  assert.ok(result.data.warnings.some((w) => /doc_absent/.test(w)));
});

test("links the business objects to the annotations and the documents", () => {
  const result = parseDpgf(dpgfSample());
  const [scope] = result.data.scopes;
  const [listing] = scope.businessObjectListings;
  assert.equal(listing.type, "STANDARD");
  const [title, article] = listing.items;
  assert.equal(title.isTitle, true);
  assert.equal(article.parentRef, "o1");
  assert.equal(article.refQty, 404);
  assert.notEqual(article.id, "o2");

  const annotation = scope.listings[0].annotations[0];
  assert.deepEqual(article.annotationIds, [annotation.id]);
  assert.deepEqual(article.documentLinks, [
    {
      documentId: result.data.documents[0].id,
      pageNumber: 12,
      title: "4.1 Étanchéité",
    },
  ]);
  assert.ok(
    result.data.warnings.some((w) =>
      /1 annotation\(s\), 1 ouvrage\(s\), 1 document\(s\)/.test(w)
    )
  );
});

test("parses the issues with their relations", () => {
  const result = parseDpgf(dpgfSample());
  const [scope] = result.data.scopes;
  assert.equal(scope.issues.length, 1);
  const [issue] = scope.issues;
  const article = scope.businessObjectListings[0].items[1];
  assert.equal(issue.label, "Échelle douteuse");
  assert.deepEqual(issue.annotationIds, [scope.listings[0].annotations[0].id]);
  assert.deepEqual(issue.businessObjects, [
    { id: article.id, label: "Étanchéité terrasse", code: "4.1." },
  ]);
  assert.deepEqual(issue.documentLinks, [
    { documentId: result.data.documents[0].id, pageNumber: null, title: null },
  ]);
  assert.equal(result.summary.issues, 1);
  assert.equal(result.summary.businessObjects, 2);
  assert.equal(result.summary.businessObjectListings, 1);
  assert.equal(result.summary.documents, 1);
});

test("links never cross two scopes", () => {
  const json = dpgfSample();
  json.scopes[1].issues = [{ label: "Autre scope", annotationIds: ["a1"] }];
  const result = parseDpgf(json);
  assert.deepEqual(result.data.scopes[1].issues[0].annotationIds, []);
});

test("rejects an unknown business object listing type", () => {
  const json = dpgfSample();
  json.scopes[0].businessObjectListings[0].type = "ISSUE";
  assert.match(parseDpgf(json).error, /type inconnu : ISSUE/);
});
