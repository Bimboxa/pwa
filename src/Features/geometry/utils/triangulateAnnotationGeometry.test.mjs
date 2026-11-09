// Run: node src/Features/geometry/utils/triangulateAnnotationGeometry.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The sources use extensionless / aliased imports: bundled with esbuild and
// imported from a data URL (same recipe as subtractAnnotationGeometries.test).
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const bundle = await build({
  stdin: {
    contents: `
      export { default as triangulateAnnotationGeometry } from "Features/geometry/utils/triangulateAnnotationGeometry";
      export { default as getAnnotationQties } from "Features/annotations/utils/getAnnotationQties";
    `,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { Features: path.join(root, "src/Features") },
  logLevel: "silent",
});
const { triangulateAnnotationGeometry, getAnnotationQties } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const contour = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 3 },
  { x: 0, y: 3 },
];
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("openTop: the prism without its top face", () => {
  const closed = triangulateAnnotationGeometry({ contour, height: 1 });
  const open = triangulateAnnotationGeometry({
    contour,
    height: 1,
    openTop: true,
  });

  assert.ok(near(closed.areaTop, 6));
  assert.equal(open.topRange[1], 0);
  assert.equal(open.areaTop, 0);
  assert.ok(near(open.areaBottom, 6));
  assert.ok(near(open.areaSides, 10));
  assert.ok(near(open.volume, closed.volume));
  assert.equal(open.indices.length, closed.indices.length - closed.topRange[1]);

  // No triangle left at the top level.
  for (let i = 0; i < open.indices.length; i += 3) {
    const zs = [0, 1, 2].map(
      (k) => open.positions[open.indices[i + k] * 3 + 2]
    );
    assert.ok(!zs.every((z) => near(z, 1)));
  }
});

test("openTop: no effect without a height", () => {
  const sheet = triangulateAnnotationGeometry({ contour, openTop: true });
  assert.ok(near(sheet.areaTop, 6));
  assert.ok(sheet.topRange[1] > 0);
});

test("quantities of a « Fosse »: bottom + sides, the top is not counted", () => {
  // 2 m × 3 m footprint, 1 m deep, 1 px = 1 m.
  const annotation = { type: "POLYGON", points: contour, height: 1 };
  const args = { meterByPx: 1 };
  const closed = getAnnotationQties({ annotation, ...args });
  const open = getAnnotationQties({
    annotation: { ...annotation, shape3D: { key: "FOSSE" } },
    ...args,
  });
  assert.ok(near(closed.surfaceDeveloped, 2 * 6 + 10), closed.surfaceDeveloped);
  assert.ok(near(open.surfaceDeveloped, 6 + 10), open.surfaceDeveloped);
  assert.ok(near(open.surface, 6));

  // Per-vertex offsets: the triangulated branch drops the top too.
  const sloped = contour.map((p, i) =>
    i === 0 ? { ...p, offsetBottom: 0.0001 } : p
  );
  const openSloped = getAnnotationQties({
    annotation: { ...annotation, points: sloped, shape3D: { key: "FOSSE" } },
    ...args,
  });
  assert.ok(
    Math.abs(openSloped.surfaceDeveloped - 16) < 1e-2,
    openSloped.surfaceDeveloped
  );
});
