import assert from "node:assert/strict";
import { test } from "node:test";

import parsePromptIaResult, {
  guessListingCoordinateSpace,
  hasExtendedKeys,
} from "./parsePromptIaResult.js";

function makeIds() {
  let n = 0;
  return () => `id${++n}`;
}

const WORLD = {
  unit: "m",
  corners: {
    topLeft: { x: 100, y: 280 },
    topRight: { x: 150, y: 280 },
    bottomLeft: { x: 100, y: 200 },
  },
};

const RESULT = {
  version: "1.0",
  note: "2 sources comparées",
  baseMaps: [
    {
      id: "bm_dxf",
      kind: "plan",
      name: "Coffrage (DXF)",
      source: { file: "fonds/dxf.pdf", pageNumber: 1 },
      world: WORLD,
    },
    {
      id: "bm_ifc",
      kind: "plan",
      name: "Maquette (IFC)",
      source: { file: "ifc.png" },
      world: WORLD,
    },
  ],
  listings: [
    {
      id: "l_dxf",
      name: "DXF — Coffrage",
      coordinateSpace: "world",
      annotationTemplates: [
        { id: "tpl_massif", label: "Massif", type: "POLYGON" },
      ],
      annotations: [
        {
          id: "a1",
          type: "POLYGON",
          annotationTemplateId: "tpl_massif",
          baseMapId: "bm_dxf",
          points: [
            { x: 110, y: 250 },
            { x: 111, y: 250 },
            { x: 111, y: 251 },
          ],
        },
      ],
    },
    {
      id: "l_ifc",
      name: "IFC — Maquette",
      annotationTemplates: [
        { id: "tpl_massif", label: "Massif", type: "POLYGON" },
      ],
      annotations: [
        {
          id: "b1",
          type: "POLYGON",
          annotationTemplateId: "tpl_massif",
          baseMapId: "bm_ifc",
          points: [
            { x: 0.2, y: 0.3 },
            { x: 0.25, y: 0.3 },
            { x: 0.25, y: 0.35 },
          ],
        },
      ],
    },
  ],
  issues: [
    {
      label: "Massif décalé de 12 cm",
      description: "DXF vs IFC",
      annotationIds: ["a1", "b1", "ghost"],
      documentLinks: [{ attachmentId: "att_dxf" }, { attachmentId: "nope" }],
    },
    { description: "sans libellé" },
  ],
};

const OPTIONS = {
  zipPaths: ["fonds/dxf.pdf", "fonds/ifc.png"],
  attachmentIds: ["att_dxf", "att_ifc"],
};

test("parses plan base maps, listings and issues with fresh ids", () => {
  const r = parsePromptIaResult(RESULT, { ...OPTIONS, newId: makeIds() });
  assert.equal(r.ok, true);
  assert.equal(r.legacy, null);
  assert.deepEqual(r.summary, {
    baseMaps: 2,
    listings: 2,
    templates: 2,
    annotations: 2,
    issues: 1,
  });
  const [dxf, ifc] = r.baseMaps;
  assert.deepEqual(dxf.source, {
    file: "fonds/dxf.pdf",
    isPdf: true,
    pageNumber: 1,
  });
  // bare file name resolved against the zip entries
  assert.deepEqual(ifc.source, {
    file: "fonds/ifc.png",
    isPdf: false,
    pageNumber: null,
  });
  assert.equal(dxf.world.widthMeters, 50);
  const [l1, l2] = r.listings;
  assert.equal(l1.coordinateSpace, "world");
  // not given: guessed from normalized values
  assert.equal(l2.coordinateSpace, "image");
  assert.equal(l1.annotations[0].baseMapId, dxf.id);
  assert.equal(l2.annotations[0].baseMapId, ifc.id);
  assert.notEqual(l1.annotations[0].id, "a1");
  assert.equal(
    l1.annotations[0].annotationTemplateId,
    l1.annotationTemplates[0].id
  );
  // same author template id in two listings: two distinct rows
  assert.notEqual(l1.annotationTemplates[0].id, l2.annotationTemplates[0].id);
  const [issue] = r.issues;
  assert.deepEqual(issue.annotationIds, [
    l1.annotations[0].id,
    l2.annotations[0].id,
  ]);
  assert.deepEqual(issue.documentLinks, [
    { documentId: "att_dxf", pageNumber: null, title: null },
  ]);
  assert.equal(r.note, "2 sources comparées");
  assert.ok(r.warnings.some((w) => /sans libellé/.test(w)));
  assert.ok(r.warnings.some((w) => /1 annotation\(s\), 1 pièce/.test(w)));
});

test("keeps the historical keys apart, issues may link them", () => {
  const r = parsePromptIaResult(
    {
      version: "1.0",
      coordinateSpace: "image",
      image: { width: 10, height: 10 },
      annotationTemplates: [{ id: "t", label: "Mur", type: "POLYLINE" }],
      annotations: [
        { id: "w1", type: "POLYLINE", annotationTemplateId: "t", points: [] },
      ],
      baseMaps: [
        { id: "bm_A", kind: "detail", source: { attachmentId: "att" } },
        RESULT.baseMaps[0],
      ],
      listings: [RESULT.listings[0]],
      issues: [{ label: "Doute", annotationIds: ["w1", "a1"] }],
    },
    { ...OPTIONS, newId: makeIds() }
  );
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.legacy).sort(), [
    "annotationTemplates",
    "annotations",
    "baseMaps",
    "coordinateSpace",
    "image",
    "version",
  ]);
  assert.deepEqual(
    r.legacy.baseMaps.map((b) => b.id),
    ["bm_A"]
  );
  assert.equal(r.baseMaps.length, 1);
  // legacy annotation linked by its author id
  assert.deepEqual(r.issues[0].annotationIds, [
    "w1",
    r.listings[0].annotations[0].id,
  ]);
});

test("fatal errors", () => {
  const parse = (json, options = OPTIONS) =>
    parsePromptIaResult(json, { ...options, newId: makeIds() });
  assert.match(
    parse(RESULT, { ...OPTIONS, zipPaths: null }).error,
    /déposez le zip/
  );
  assert.match(
    parse({
      baseMaps: [{ ...RESULT.baseMaps[0], source: { file: "x.pdf" } }],
    }).error,
    /introuvable/
  );
  assert.match(
    parse({ baseMaps: [{ ...RESULT.baseMaps[0], world: null }] }).error,
    /world/
  );
  assert.match(
    parse({ baseMaps: [RESULT.baseMaps[0], RESULT.baseMaps[0]] }).error,
    /double/
  );
  assert.match(
    parse({
      baseMaps: RESULT.baseMaps,
      listings: [
        {
          ...RESULT.listings[0],
          annotations: [
            { ...RESULT.listings[0].annotations[0], baseMapId: "x" },
          ],
        },
      ],
    }).error,
    /baseMapId inconnu/
  );
  assert.match(
    parse({
      baseMaps: RESULT.baseMaps,
      listings: [{ ...RESULT.listings[0], coordinateSpace: "pdf_user_space" }],
    }).error,
    /coordinateSpace/
  );
  assert.match(parse({ listings: {} }).error, /tableau/);
});

test("helpers", () => {
  assert.equal(hasExtendedKeys(RESULT), true);
  assert.equal(
    hasExtendedKeys({ annotations: [], baseMaps: [{ kind: "detail" }] }),
    false
  );
  assert.equal(hasExtendedKeys({ issues: [{ label: "x" }] }), true);
  assert.equal(
    guessListingCoordinateSpace([{ points: [{ x: 0.5, y: 1 }] }]),
    "image"
  );
  assert.equal(
    guessListingCoordinateSpace([{ cuts: [{ points: [{ x: 12, y: 0.4 }] }] }]),
    "world"
  );
  assert.equal(guessListingCoordinateSpace([]), "world");
});
