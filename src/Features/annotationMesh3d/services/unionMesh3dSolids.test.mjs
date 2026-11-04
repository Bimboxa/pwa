import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

// Same harness as subtractAnnotationGeometries.test.mjs: the real union is
// bundled with its own copy of three / three-bvh-csg.
const bundle = await build({
  stdin: {
    contents: `
      export { default as unionMesh3dSolids, getMesh3dOverlapVolume, MIN_OVERLAP_VOLUME_M3 } from "Features/annotationMesh3d/services/unionMesh3dSolids";
      export { default as isMesh3dClosed } from "Features/annotationMesh3d/utils/isMesh3dClosed";
      export { getMesh3dSignedVolume } from "Features/annotationMesh3d/utils/getMesh3dQties";
    `,
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
          path: path.join(
            root,
            "src",
            args.path.endsWith(".js") ? args.path : args.path + ".js"
          ),
        }));
      },
    },
  ],
});
const {
  unionMesh3dSolids,
  getMesh3dOverlapVolume,
  MIN_OVERLAP_VOLUME_M3,
  isMesh3dClosed,
  getMesh3dSignedVolume,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// Axis-aligned box as a LOCAL mesh (outward CCW faces), z up.
function box(x0, x1, y0, y1, z0, z1) {
  const vertices = [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x1, y: y1, z: z0 },
    { x: x0, y: y1, z: z0 },
    { x: x0, y: y0, z: z1 },
    { x: x1, y: y0, z: z1 },
    { x: x1, y: y1, z: z1 },
    { x: x0, y: y1, z: z1 },
  ];
  const faces = [
    { loop: [0, 3, 2, 1], holes: [] },
    { loop: [4, 5, 6, 7], holes: [] },
    { loop: [0, 1, 5, 4], holes: [] },
    { loop: [2, 3, 7, 6], holes: [] },
    { loop: [1, 2, 6, 5], holes: [] },
    { loop: [3, 0, 4, 7], holes: [] },
  ];
  return { vertices, faces };
}

test("a wall through a slab: closed union, volume = Va + Vb - Vab", () => {
  const slab = box(0, 4, 0, 4, 3, 3.2);
  const wall = box(1, 1.2, 0.5, 3.5, 0.4, 3.2);
  const overlap = getMesh3dOverlapVolume(slab, wall);
  assert.ok(overlap > MIN_OVERLAP_VOLUME_M3);
  assert.ok(Math.abs(overlap - 0.2 * 3 * 0.2) < 1e-6);
  const result = unionMesh3dSolids(slab, wall);
  assert.equal(result.ok, true);
  assert.ok(isMesh3dClosed(result.mesh));
  const expected = 4 * 4 * 0.2 + 0.2 * 3 * 2.8 - 0.2 * 3 * 0.2;
  // float32 brushes: a few 1e-5 m³ of noise on ~5 m³.
  assert.ok(
    Math.abs(getMesh3dSignedVolume(result.mesh) - expected) < 1e-4,
    `volume ${getMesh3dSignedVolume(result.mesh)} vs ${expected}`
  );
  // The slab's bottom face gained the wall's footprint as a hole.
  const withHole = result.mesh.faces.filter((face) => face.holes?.length);
  assert.ok(withHole.length >= 1);
});

test("abutting and disjoint boxes share no volume", () => {
  const a = box(0, 1, 0, 0.2, 0, 2.5);
  assert.ok(
    getMesh3dOverlapVolume(a, box(1, 2, 0, 0.2, 0, 2.5)) < MIN_OVERLAP_VOLUME_M3
  );
  assert.equal(getMesh3dOverlapVolume(a, box(3, 4, 0, 0.2, 0, 2.5)), 0);
});
