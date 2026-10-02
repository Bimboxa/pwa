import assert from "node:assert/strict";
import { test } from "node:test";

import filterDrawingToolsForEditor, {
  DRAWING_TOOLS_EDITOR_2D,
  DRAWING_TOOLS_EDITOR_3D,
  getDrawingToolsEditor,
  isDrawingToolAvailable,
  pickDrawingTool,
} from "./filterDrawingToolsForEditor.js";

// Minimal stand-ins of DRAWING_TOOLS entries (drawingTools.jsx pulls MUI).
const POLYGON_CLICK = { key: "POLYGON_CLICK", annotationType: "POLYGON" };
const POLYGON_RECTANGLE = {
  key: "POLYGON_RECTANGLE",
  annotationType: "POLYGON",
};
const RAMP = { key: "RAMP", annotationType: "POLYGON" };
const MESH_BRUSH = {
  key: "MESH_BRUSH",
  annotationType: null,
  editor: "3D",
  requiresTemplate: true,
};
const TWO_D_ONLY = { key: "TWO_D_ONLY", editor: "2D" };
const TEMPLATE_ONLY = { key: "TEMPLATE_ONLY", requiresTemplate: true };

const POLYGON_TOOLS = [POLYGON_CLICK, POLYGON_RECTANGLE, RAMP, MESH_BRUSH];

const keysOf = (tools) => tools.map((t) => t.key);

test("default editor is 2D: the 3D-only brush is never offered", () => {
  assert.deepEqual(keysOf(filterDrawingToolsForEditor(POLYGON_TOOLS)), [
    "POLYGON_CLICK",
    "POLYGON_RECTANGLE",
    "RAMP",
  ]);
  assert.deepEqual(keysOf(filterDrawingToolsForEditor(POLYGON_TOOLS, {})), [
    "POLYGON_CLICK",
    "POLYGON_RECTANGLE",
    "RAMP",
  ]);
});

test("3D editor offers the brush, last (order kept)", () => {
  assert.deepEqual(
    keysOf(filterDrawingToolsForEditor(POLYGON_TOOLS, { editor: "3D" })),
    ["POLYGON_CLICK", "POLYGON_RECTANGLE", "RAMP", "MESH_BRUSH"]
  );
});

test("template-less drafts never get a requiresTemplate tool", () => {
  assert.deepEqual(
    keysOf(
      filterDrawingToolsForEditor([...POLYGON_TOOLS, TEMPLATE_ONLY], {
        editor: "3D",
        templateless: true,
      })
    ),
    ["POLYGON_CLICK", "POLYGON_RECTANGLE", "RAMP"]
  );
  assert.deepEqual(
    keysOf(
      filterDrawingToolsForEditor([POLYGON_CLICK, TEMPLATE_ONLY], {
        templateless: false,
      })
    ),
    ["POLYGON_CLICK", "TEMPLATE_ONLY"]
  );
});

test("a 2D-only tool is dropped in 3D", () => {
  assert.deepEqual(
    keysOf(
      filterDrawingToolsForEditor([POLYGON_CLICK, TWO_D_ONLY], {
        editor: "3D",
      })
    ),
    ["POLYGON_CLICK"]
  );
  assert.deepEqual(
    keysOf(filterDrawingToolsForEditor([POLYGON_CLICK, TWO_D_ONLY])),
    ["POLYGON_CLICK", "TWO_D_ONLY"]
  );
});

test("null / undefined inputs", () => {
  assert.deepEqual(filterDrawingToolsForEditor(null), []);
  assert.deepEqual(
    filterDrawingToolsForEditor(undefined, { editor: "3D" }),
    []
  );
  assert.equal(isDrawingToolAvailable(null), false);
  assert.equal(isDrawingToolAvailable(MESH_BRUSH), false);
  assert.equal(isDrawingToolAvailable(MESH_BRUSH, { editor: "3D" }), true);
  assert.equal(
    isDrawingToolAvailable(MESH_BRUSH, { editor: "3D", templateless: true }),
    false
  );
});

test("pickDrawingTool: membership, then fallback order", () => {
  const tools2d = filterDrawingToolsForEditor(POLYGON_TOOLS, { editor: "2D" });
  const tools3d = filterDrawingToolsForEditor(POLYGON_TOOLS, { editor: "3D" });

  // A brush remembered for the template falls back in 2D (to defaultTool,
  // then to the first tool), and is picked again in 3D.
  assert.equal(pickDrawingTool(tools2d, ["MESH_BRUSH", "RAMP"]).key, "RAMP");
  assert.equal(
    pickDrawingTool(tools2d, ["MESH_BRUSH", undefined]).key,
    "POLYGON_CLICK"
  );
  assert.equal(
    pickDrawingTool(tools3d, ["MESH_BRUSH", "RAMP"]).key,
    "MESH_BRUSH"
  );

  // Unknown / foreign keys are skipped.
  assert.equal(
    pickDrawingTool(tools3d, ["DETECT_SIMILAR_POLYLINES", "POLYGON_RECTANGLE"])
      .key,
    "POLYGON_RECTANGLE"
  );
  assert.equal(
    pickDrawingTool(tools3d, [null, "", undefined]).key,
    "POLYGON_CLICK"
  );
  assert.equal(pickDrawingTool(tools3d).key, "POLYGON_CLICK");

  // Empty list → null.
  assert.equal(pickDrawingTool([], ["MESH_BRUSH"]), null);
  assert.equal(pickDrawingTool(null, ["MESH_BRUSH"]), null);
});

test("getDrawingToolsEditor: 3D only in the Dessin module's 3D editor", () => {
  assert.equal(
    getDrawingToolsEditor({ moduleKey: "MAP", effectiveViewerKey: "THREED" }),
    DRAWING_TOOLS_EDITOR_3D
  );
  assert.equal(
    getDrawingToolsEditor({ moduleKey: "MAP", effectiveViewerKey: "MESHES" }),
    DRAWING_TOOLS_EDITOR_3D
  );
  assert.equal(
    getDrawingToolsEditor({ moduleKey: "MAP", effectiveViewerKey: "MAP" }),
    DRAWING_TOOLS_EDITOR_2D
  );
  // Other modules showing the 3D editor keep the 2D list.
  assert.equal(
    getDrawingToolsEditor({
      moduleKey: "THREED",
      effectiveViewerKey: "THREED",
    }),
    DRAWING_TOOLS_EDITOR_2D
  );
  assert.equal(
    getDrawingToolsEditor({ moduleKey: "ZONES", effectiveViewerKey: "THREED" }),
    DRAWING_TOOLS_EDITOR_2D
  );
  assert.equal(getDrawingToolsEditor(), DRAWING_TOOLS_EDITOR_2D);
});
