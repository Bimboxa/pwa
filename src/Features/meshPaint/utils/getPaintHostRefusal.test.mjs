import assert from "node:assert/strict";
import { test } from "node:test";

import getMeshPaintColor from "./getMeshPaintColor.js";
import getPaintHostRefusal, {
  PAINT_REFUSAL,
  PAINT_REFUSAL_LABELS,
  getPaintRefusalLabel,
} from "./getPaintHostRefusal.js";

test("a plain wall of another template is paintable", () => {
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYLINE", annotationTemplateId: "tWall" },
      armedTemplateId: "tPaint",
    }),
    null
  );
  // No armed template: nothing to compare.
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYGON", annotationTemplateId: "t" },
    }),
    null
  );
});

test("host types that cannot be painted", () => {
  assert.equal(
    getPaintHostRefusal({ source: { type: "OBJECT_3D" } }),
    PAINT_REFUSAL.OBJECT_3D
  );
  assert.equal(
    getPaintHostRefusal({ source: { type: "IMAGE" } }),
    PAINT_REFUSAL.IMAGE
  );
  // Type from the root userData when the source is unknown.
  assert.equal(
    getPaintHostRefusal({ rootUserData: { annotationType: "OBJECT_3D" } }),
    PAINT_REFUSAL.OBJECT_3D
  );
});

test("curved shells (REVOLUTION / EXTRUSION_PROFILE) are refused", () => {
  for (const key of ["REVOLUTION", "EXTRUSION_PROFILE"]) {
    assert.equal(
      getPaintHostRefusal({
        source: { type: "POLYLINE", shape3D: { key, profileTemplateId: "p" } },
      }),
      PAINT_REFUSAL.CURVED_SHAPE
    );
  }
  // Other shape variants are fine.
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYGON", shape3D: { key: "SHELL_TENT" } },
    }),
    null
  );
});

test("mesh cells, photo plans and the armed template's own annotations", () => {
  assert.equal(
    getPaintHostRefusal({ source: { type: "POLYGON", isMeshCell: true } }),
    PAINT_REFUSAL.MESH_CELL
  );
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYGON" },
      isUnderBaseMapGroup: false,
    }),
    PAINT_REFUSAL.PHOTO_PLAN
  );
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYGON", _photoPlan3D: { pose: {} } },
    }),
    PAINT_REFUSAL.PHOTO_PLAN
  );
  assert.equal(
    getPaintHostRefusal({
      source: { type: "POLYGON", annotationTemplateId: "tPaint" },
      armedTemplateId: "tPaint",
    }),
    PAINT_REFUSAL.OWN_TEMPLATE
  );
  assert.equal(
    getPaintHostRefusal({
      rootUserData: { annotationTemplateId: "tPaint" },
      armedTemplateId: "tPaint",
    }),
    PAINT_REFUSAL.OWN_TEMPLATE
  );
});

test("every refusal reason has a French label", () => {
  for (const reason of Object.values(PAINT_REFUSAL)) {
    assert.equal(typeof PAINT_REFUSAL_LABELS[reason], "string");
    assert.equal(getPaintRefusalLabel(reason), PAINT_REFUSAL_LABELS[reason]);
  }
  assert.equal(getPaintRefusalLabel("UNKNOWN"), "Non peignable");
});

test("paint colour: 3D override, then fill (FACE) / stroke (EDGE)", () => {
  const template = {
    fillColor: "#112233",
    strokeColor: "#445566ff",
  };
  assert.equal(getMeshPaintColor(template, "FACE"), "#112233");
  assert.equal(getMeshPaintColor(template, "EDGE"), "#445566");
  assert.equal(
    getMeshPaintColor({ ...template, color3D: "#abcdef80" }, "EDGE"),
    "#abcdef"
  );
  assert.equal(getMeshPaintColor({ strokeColor: "#f00" }, "FACE"), "#f00");
  assert.equal(getMeshPaintColor(null, "FACE"), "#cccccc");
});
