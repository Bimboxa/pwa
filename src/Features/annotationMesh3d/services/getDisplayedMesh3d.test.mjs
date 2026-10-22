import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

// Bundle the real service (path aliases, three included: a data: URL import
// resolves no bare specifier — the test's own three objects are read by duck
// typing, so two copies are fine).
const bundle = await build({
  stdin: {
    contents: `export { default } from "Features/annotationMesh3d/services/getDisplayedMesh3d";`,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "aliases",
      setup(b) {
        b.onResolve({ filter: /^Features\// }, (args) => ({
          path: path.join(root, "src", args.path + ".js"),
        }));
      },
    },
  ],
});
const { default: getDisplayedMesh3d } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// Slab 4 × 4 × 0.3 pierced by a 1 × 1 column: the CSG soup of a live carve.
function carvedSlabGeometry() {
  const slab = new Brush(new BoxGeometry(4, 4, 0.3).translate(0, 0, 0.15));
  const column = new Brush(new BoxGeometry(1, 1, 2).translate(0, 0, 0.5));
  slab.updateMatrixWorld();
  column.updateMatrixWorld();
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  return evaluator.evaluate(slab, column, SUBTRACTION).geometry;
}

// A regular annotation's displayed object: a Group holding the SOLID mesh,
// parented in its base map group, as the builders do.
function scene({ carved }) {
  const baseMapGroup = new Group();
  const solid = new Mesh(
    carved
      ? carvedSlabGeometry()
      : new BoxGeometry(4, 4, 0.3).translate(0, 0, 0.15),
    new MeshBasicMaterial()
  );
  solid.userData = carved
    ? { role: "SOLID", hasSubtraction: true }
    : { role: "SOLID" };
  const object = new Group();
  object.add(solid);
  baseMapGroup.add(object);
  baseMapGroup.updateMatrixWorld(true);
  const editor = {
    sceneManager: {
      annotationsManager: {
        annotationsObjectsMap: { a1: object },
        getAnnotationSource: () => ({
          id: "a1",
          type: "POLYGON",
          baseMapId: "bm",
        }),
      },
      imagesManager: { getGroup: () => baseMapGroup },
    },
  };
  return { editor, solid };
}

test("a host carved live by a subtraction has selectable faces", () => {
  const { editor } = scene({ carved: true });
  const displayed = getDisplayedMesh3d(editor, "a1");
  assert.ok(displayed);
  assert.equal(displayed.carved, true);
  // top + bottom (each with one hole) + 4 outer sides + 4 hole sides.
  assert.equal(displayed.mesh.faces.length, 10);
  assert.equal(
    displayed.mesh.faces.filter((f) => f.holes?.length === 1).length,
    2
  );
});

test("an uncarved host keeps the plain conversion", () => {
  const { editor } = scene({ carved: false });
  const displayed = getDisplayedMesh3d(editor, "a1");
  assert.ok(displayed);
  assert.equal(displayed.carved, false);
  assert.equal(displayed.mesh.faces.length, 6);
});

test("the cache follows a geometry swapped in place by the carve", () => {
  const { editor, solid } = scene({ carved: false });
  assert.equal(getDisplayedMesh3d(editor, "a1").mesh.faces.length, 6);
  // subtractAnnotationGeometries: new geometry + flag on the SAME mesh.
  solid.geometry = carvedSlabGeometry();
  solid.userData = { ...solid.userData, hasSubtraction: true };
  const displayed = getDisplayedMesh3d(editor, "a1");
  assert.equal(displayed.carved, true);
  assert.equal(displayed.mesh.faces.length, 10);
});
