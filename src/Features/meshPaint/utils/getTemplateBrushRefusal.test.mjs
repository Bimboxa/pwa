import assert from "node:assert/strict";
import { test } from "node:test";

import getTemplateBrushRefusal, {
  TEMPLATE_BRUSH_REFUSAL,
  getTemplateBrushRefusalLabel,
} from "./getTemplateBrushRefusal.js";

const surface = { id: "a1", type: "POLYGON", annotationTemplateId: "tOld" };

test("a surface of another template is accepted by a Surface template", () => {
  assert.equal(
    getTemplateBrushRefusal({
      annotation: surface,
      templateId: "tNew",
      templateShape: "POLYGON",
    }),
    null
  );
});

test("a line, a strip, a surface are accepted by a Ligne template", () => {
  for (const type of ["POLYLINE", "STRIP", "POLYGON"]) {
    assert.equal(
      getTemplateBrushRefusal({
        annotation: { ...surface, type },
        templateId: "tNew",
        templateShape: "POLYLINE",
      }),
      null,
      type
    );
  }
});

test("the annotation's own template is refused (never a duplicate)", () => {
  assert.equal(
    getTemplateBrushRefusal({
      annotation: surface,
      templateId: "tOld",
      templateShape: "POLYGON",
    }),
    TEMPLATE_BRUSH_REFUSAL.SAME_TEMPLATE
  );
});

test("no armed template", () => {
  assert.equal(
    getTemplateBrushRefusal({ annotation: surface, templateShape: "POLYGON" }),
    TEMPLATE_BRUSH_REFUSAL.NO_TEMPLATE
  );
});

test("read-only pseudo rows are refused", () => {
  assert.equal(
    getTemplateBrushRefusal({
      annotation: {
        ...surface,
        id: "revolution::a1",
        isForeignFootprint: true,
      },
      templateId: "tNew",
      templateShape: "POLYGON",
    }),
    TEMPLATE_BRUSH_REFUSAL.READ_ONLY
  );
  assert.equal(
    getTemplateBrushRefusal({
      annotation: { ...surface, isMeshCell: true },
      templateId: "tNew",
      templateShape: "POLYGON",
    }),
    TEMPLATE_BRUSH_REFUSAL.READ_ONLY
  );
  assert.equal(
    getTemplateBrushRefusal({ templateId: "tNew", templateShape: "POLYGON" }),
    TEMPLATE_BRUSH_REFUSAL.READ_ONLY
  );
});

test("other geometries are refused", () => {
  for (const type of [
    "MARKER",
    "LABEL",
    "RECTANGLE",
    "COTE",
    "RULER",
    "LINEAR_LAYOUT",
    "IMAGE",
  ]) {
    assert.equal(
      getTemplateBrushRefusal({
        annotation: { ...surface, type },
        templateId: "tNew",
        templateShape: "POLYGON",
      }),
      TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE,
      type
    );
  }
  // The effective type (healed LABEL row read as a polygon) wins.
  assert.equal(
    getTemplateBrushRefusal({
      annotation: { ...surface, type: "LABEL" },
      annotationType: "POLYGON",
      templateId: "tNew",
      templateShape: "POLYGON",
    }),
    null
  );
});

test("a template whose shape has no brush is refused", () => {
  assert.equal(
    getTemplateBrushRefusal({
      annotation: surface,
      templateId: "tNew",
      templateShape: "MARKER",
    }),
    TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE
  );
});

test("a mesh 3D annotation only accepts a Surface template", () => {
  const mesh = { ...surface, isMesh3d: true };
  assert.equal(
    getTemplateBrushRefusal({
      annotation: mesh,
      templateId: "tNew",
      templateShape: "POLYGON",
    }),
    null
  );
  assert.equal(
    getTemplateBrushRefusal({
      annotation: mesh,
      templateId: "tNew",
      templateShape: "POLYLINE",
    }),
    TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE
  );
});

test("labels", () => {
  assert.equal(
    getTemplateBrushRefusalLabel("SAME_TEMPLATE"),
    "Cette annotation porte déjà ce modèle"
  );
  assert.equal(
    getTemplateBrushRefusalLabel("???"),
    "Annotation non convertible"
  );
});
