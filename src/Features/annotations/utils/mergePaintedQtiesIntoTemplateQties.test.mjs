import assert from "node:assert/strict";
import { test } from "node:test";

import mergePaintedQtiesIntoTemplateQties, {
  formatTemplateQtiesLine,
  formatTemplateQtiesTooltip,
  getPaintedPartsCountLabel,
} from "./mergePaintedQtiesIntoTemplateQties.js";

const templateById = {
  tWall: { id: "tWall", type: "POLYLINE" },
  tPlaster: { id: "tPlaster", type: "POLYGON" },
  tCorner: { id: "tCorner", type: "POLYLINE" },
  tUnits: { id: "tUnits", type: "POLYGON", mainQtyKey: "U" },
};

const painted = (extra) => ({
  surface: 0,
  length: 0,
  partsCount: 0,
  facesCount: 0,
  edgesCount: 0,
  orphansCount: 0,
  conflictsCount: 0,
  staleCount: 0,
  listedCount: 0,
  parts: [],
  ...extra,
});

const deepClone = (v) => JSON.parse(JSON.stringify(v));

test("no painted part → same object", () => {
  const qtiesById = { tWall: { count: 1, length: 3, surface: 0, unit: 1 } };
  assert.equal(
    mergePaintedQtiesIntoTemplateQties(qtiesById, {}, templateById),
    qtiesById
  );
  assert.equal(
    mergePaintedQtiesIntoTemplateQties(qtiesById, null, templateById),
    qtiesById
  );
});

test("painted-only template: count / unit 0, label from the painted m²", () => {
  const qtiesById = {
    tWall: { count: 2, length: 8, surface: 0, unit: 2, mainQtyLabel: "8 ml" },
  };
  const paintedById = {
    tPlaster: painted({
      surface: 12.4,
      partsCount: 3,
      facesCount: 3,
      listedCount: 3,
    }),
  };
  const inputs = deepClone({ qtiesById, paintedById });
  const out = mergePaintedQtiesIntoTemplateQties(
    qtiesById,
    paintedById,
    templateById
  );

  assert.notEqual(out, qtiesById);
  assert.equal(out.tWall, qtiesById.tWall); // untouched entry keeps identity
  assert.deepEqual(deepClone({ qtiesById, paintedById }), inputs); // no mutation

  const p = out.tPlaster;
  assert.equal(p.count, 0);
  assert.equal(p.unit, 0);
  assert.equal(p.surface, 12.4);
  assert.equal(p.annotationsSurface, 0);
  assert.equal(p.paintedSurface, 12.4);
  assert.equal(p.paintedCount, 3);
  assert.equal(p.mainQtyLabel, "12.4 m²");
  assert.equal(formatTemplateQtiesLine(p), "12.40 m² · 3 faces");
});

test("drawn + painted POLYLINE template: lengths add, count / unit kept", () => {
  const qtiesById = {
    tCorner: {
      count: 2,
      length: 10,
      surface: 0,
      unit: 2,
      mainQtyLabel: "10 ml",
    },
  };
  const out = mergePaintedQtiesIntoTemplateQties(
    qtiesById,
    {
      tCorner: painted({
        length: 3.2,
        partsCount: 4,
        edgesCount: 4,
        listedCount: 5,
        orphansCount: 1,
        staleCount: 2,
      }),
    },
    templateById
  );
  const c = out.tCorner;
  assert.equal(c.count, 2);
  assert.equal(c.unit, 2);
  assert.equal(c.length, 13.2);
  assert.equal(c.annotationsLength, 10);
  assert.equal(c.paintedLength, 3.2);
  assert.equal(c.mainQtyLabel, "13.2 ml");
  assert.equal(c.paintedOrphansCount, 1);
  assert.equal(formatTemplateQtiesLine(c), "2 u · 13.20 ml · 0 m² · 4 arêtes");
  assert.equal(
    formatTemplateQtiesTooltip(c),
    "Annotations : 10.00 ml — Parties peintes : 3.20 ml (4 arêtes) — " +
      "1 orpheline (non comptée) — 2 à vérifier (ouvrir en 3D)"
  );
});

test("mainQtyKey U: painted m² do not change the unit label", () => {
  const out = mergePaintedQtiesIntoTemplateQties(
    {},
    {
      tUnits: painted({
        surface: 5,
        partsCount: 1,
        facesCount: 1,
        listedCount: 1,
      }),
    },
    templateById
  );
  assert.equal(out.tUnits.mainQtyLabel, "0 u");
  assert.equal(out.tUnits.surface, 5);
});

test("unknown template → unit label, like computeAnnotationTemplateQties", () => {
  const out = mergePaintedQtiesIntoTemplateQties(
    undefined,
    { tGone: painted({ surface: 2, partsCount: 1, listedCount: 1 }) },
    templateById
  );
  assert.equal(out.tGone.mainQtyLabel, "0 u");
});

test("orphan-only template: listed with a zero total", () => {
  const out = mergePaintedQtiesIntoTemplateQties(
    {},
    { tPlaster: painted({ listedCount: 1, orphansCount: 1 }) },
    templateById
  );
  assert.equal(out.tPlaster.paintedCount, 0);
  assert.equal(out.tPlaster.mainQtyLabel, "0 m²");
  assert.equal(formatTemplateQtiesLine(out.tPlaster), "1 partie non comptée");
});

test("secondary line variants", () => {
  assert.equal(formatTemplateQtiesLine(undefined), "0 annot.");
  assert.equal(
    formatTemplateQtiesLine({ count: 2, unit: 2, length: 14, surface: 30.2 }),
    "2 u · 14.00 ml · 30.20 m²"
  );
  assert.equal(
    formatTemplateQtiesLine({
      count: 0,
      unit: 0,
      length: 6.2,
      surface: 12.4,
      paintedFacesCount: 3,
      paintedEdgesCount: 4,
      paintedListedCount: 7,
    }),
    "6.20 ml · 12.40 m² · 7 parties"
  );
  // the annotations count of the detail list wins over stats.count
  assert.equal(formatTemplateQtiesLine({ count: 3 }, 0), "0 annot.");
  assert.equal(getPaintedPartsCountLabel({ paintedFacesCount: 1 }), "1 face");
  assert.equal(getPaintedPartsCountLabel({}), null);
  assert.equal(formatTemplateQtiesTooltip({ count: 2 }), null);
});

test("drawingShape-only template (no type, no mainQtyKey): m² / ml label", () => {
  const byId = {
    tEnduit: { id: "tEnduit", drawingShape: "POLYGON" },
    tJoint: { id: "tJoint", drawingShape: "POLYLINE" },
  };
  const out = mergePaintedQtiesIntoTemplateQties(
    {},
    {
      tEnduit: painted({
        surface: 12,
        partsCount: 3,
        facesCount: 3,
        listedCount: 3,
      }),
      tJoint: painted({
        length: 6.2,
        partsCount: 4,
        edgesCount: 4,
        listedCount: 4,
      }),
    },
    byId
  );
  assert.equal(out.tEnduit.mainQtyLabel, "12 m²");
  assert.equal(out.tJoint.mainQtyLabel, "6.2 ml");
  // The template itself is not mutated.
  assert.equal(byId.tEnduit.type, undefined);
});
