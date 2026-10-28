import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TEMPLATE_VIEW3D,
  getTemplateView3d,
  getTemplateViews3dByTemplateId,
  isDefaultTemplateView3d,
  normalizeTemplateView3d,
  removeTemplateView3d,
  setTemplateView3dForTemplate,
} from "./templateView3d.js";

test("normalizeTemplateView3d coerces booleans and refuses an empty view", () => {
  assert.deepEqual(normalizeTemplateView3d(null), DEFAULT_TEMPLATE_VIEW3D);
  assert.deepEqual(
    normalizeTemplateView3d({ surface: 0, topEdge: 1, bottomEdge: "" }),
    { surface: false, topEdge: true, bottomEdge: false, outline: false }
  );
  assert.deepEqual(
    normalizeTemplateView3d({ surface: false, outline: false }),
    DEFAULT_TEMPLATE_VIEW3D
  );
});

test("isDefaultTemplateView3d", () => {
  assert.equal(isDefaultTemplateView3d(undefined), true);
  assert.equal(isDefaultTemplateView3d({ surface: true }), true);
  assert.equal(
    isDefaultTemplateView3d({ surface: true, topEdge: true }),
    false
  );
  assert.equal(isDefaultTemplateView3d({ outline: true }), false);
});

test("getTemplateViews3dByTemplateId keeps the non-default views only", () => {
  assert.equal(getTemplateViews3dByTemplateId(null), null);
  assert.equal(getTemplateViews3dByTemplateId({ templateViews3d: [] }), null);
  assert.equal(
    getTemplateViews3dByTemplateId({
      templateViews3d: [{ annotationTemplateId: "t1", surface: true }],
    }),
    null
  );
  assert.deepEqual(
    getTemplateViews3dByTemplateId({
      templateViews3d: [
        { annotationTemplateId: "t1", surface: false, bottomEdge: true },
        { annotationTemplateId: null, outline: true },
        "junk",
      ],
    }),
    {
      t1: { surface: false, topEdge: false, bottomEdge: true, outline: false },
      "": { surface: false, topEdge: false, bottomEdge: false, outline: true },
    }
  );
});

test("getTemplateView3d applies the defaults", () => {
  const object = {
    templateViews3d: [{ annotationTemplateId: "t1", topEdge: true }],
  };
  assert.deepEqual(getTemplateView3d(object, "t1"), {
    surface: false,
    topEdge: true,
    bottomEdge: false,
    outline: false,
  });
  assert.deepEqual(getTemplateView3d(object, "t2"), DEFAULT_TEMPLATE_VIEW3D);
  assert.deepEqual(getTemplateView3d(null, "t1"), DEFAULT_TEMPLATE_VIEW3D);
});

test("setTemplateView3dForTemplate replaces, and drops a default view", () => {
  const initial = [
    { annotationTemplateId: "t1", surface: false, topEdge: true },
  ];
  assert.deepEqual(
    setTemplateView3dForTemplate(initial, "t2", {
      surface: true,
      bottomEdge: true,
    }),
    [
      ...initial,
      {
        annotationTemplateId: "t2",
        surface: true,
        topEdge: false,
        bottomEdge: true,
        outline: false,
      },
    ]
  );
  assert.deepEqual(
    setTemplateView3dForTemplate(initial, "t1", { surface: true }),
    []
  );
  assert.deepEqual(
    setTemplateView3dForTemplate(undefined, null, { outline: true }),
    [
      {
        annotationTemplateId: null,
        surface: false,
        topEdge: false,
        bottomEdge: false,
        outline: true,
      },
    ]
  );
  assert.deepEqual(removeTemplateView3d(initial, "t1"), []);
  assert.deepEqual(removeTemplateView3d(initial, "t9"), initial);
});
