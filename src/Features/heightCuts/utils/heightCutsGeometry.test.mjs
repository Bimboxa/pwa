// Run: node src/Features/heightCuts/utils/heightCutsGeometry.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const bundle = await build({
  stdin: {
    contents: `
      export { default as computeHeightFaces } from "Features/heightCuts/utils/computeHeightFaces";
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
const { computeHeightFaces, triangulateAnnotationGeometry, getAnnotationQties } =
  await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

// 10 x 4 slab (meters).
const contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 0, y: 4 },
];
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const vLine = (id, x) => ({
  id,
  closeLine: false,
  points: [
    { x, y: -1 },
    { x, y: 5 },
  ],
});
const pit = (delta, side) => ({
  id: "pit",
  delta,
  side,
  points: [
    { x: 4, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 3 },
    { x: 4, y: 3 },
  ],
});

// Signed volume enclosed by a triangle mesh (divergence theorem): only a
// closed, consistently wound solid gives the expected value.
function meshVolume({ positions, indices }) {
  let sum = 0;
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]].map((i) => [
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    ]);
    sum +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return Math.abs(sum) / 6;
}

test("sheet: a podium band adds its two risers", () => {
  const heightFaces = computeHeightFaces({
    contour,
    traces: [vLine("a", 3), vLine("b", 5)],
    faceEntries: [{ id: "band", seed: { x: 4, y: 2 }, delta: 0.2 }],
  });
  const tri = triangulateAnnotationGeometry({ contour, heightFaces });
  assert.equal(tri.heightFacesApplied, true);
  assert.ok(near(tri.areaPlanar, 40));
  assert.ok(near(tri.areaTop, 40));
  assert.ok(near(tri.areaRisers, 2 * 4 * 0.2, 1e-5));
  assert.equal(tri.areaSides, 0);
  // The band sits 0.2 above the rest.
  const zs = new Set();
  for (let i = 2; i < tri.positions.length; i += 3) {
    zs.add(Math.round(tri.positions[i] * 1000) / 1000);
  }
  assert.deepEqual([...zs].sort(), [0, 0.2]);
});

test("prism: a pit on the top side is a closed solid", () => {
  const heightFaces = computeHeightFaces({
    contour,
    traces: [pit(-0.2, "TOP")],
  });
  const tri = triangulateAnnotationGeometry({
    contour,
    height: 1,
    heightFaces,
  });
  assert.ok(near(tri.areaTop, 40));
  assert.ok(near(tri.areaBottom, 40));
  assert.ok(near(tri.areaSides, 28, 1e-5));
  assert.ok(near(tri.areaRisers, 8 * 0.2, 1e-5));
  assert.ok(near(tri.volume, 40 - 4 * 0.2, 1e-5));
  assert.ok(near(meshVolume(tri), tri.volume, 1e-4));
});

test("prism: a pit on the bottom side lowers the underside", () => {
  const heightFaces = computeHeightFaces({
    contour,
    traces: [pit(-0.2, "BOTTOM")],
  });
  const tri = triangulateAnnotationGeometry({
    contour,
    height: 1,
    heightFaces,
  });
  assert.ok(near(tri.areaRisers, 8 * 0.2, 1e-5));
  assert.ok(near(tri.volume, 40 + 4 * 0.2, 1e-5));
  assert.ok(near(meshVolume(tri), tri.volume, 1e-4));
});

test("prism: a podium band across the slab with a real hole", () => {
  const hole = [
    { x: 7, y: 1 },
    { x: 8, y: 1 },
    { x: 8, y: 2 },
    { x: 7, y: 2 },
  ];
  const heightFaces = computeHeightFaces({
    contour,
    holes: [hole],
    traces: [vLine("a", 3), vLine("b", 5)],
    faceEntries: [{ id: "band", seed: { x: 4, y: 2 }, delta: 0.2 }],
  });
  const tri = triangulateAnnotationGeometry({
    contour,
    holes: [hole],
    height: 1,
    heightFaces,
  });
  assert.ok(near(tri.areaPlanar, 39));
  // Border walls: the contour (the band's two ends are 0.2 taller) + the hole.
  assert.ok(near(tri.areaSides, 28 + 2 * 2 * 0.2 + 4, 1e-5));
  assert.ok(near(tri.areaRisers, 2 * 4 * 0.2, 1e-5));
  assert.ok(near(tri.volume, 39 + 8 * 0.2, 1e-5));
  assert.ok(near(meshVolume(tri), tri.volume, 1e-4));
});

test("flat faces (no delta) keep the plain build figures", () => {
  const heightFaces = computeHeightFaces({ contour, traces: [vLine("a", 3)] });
  const stepped = triangulateAnnotationGeometry({
    contour,
    height: 1,
    heightFaces,
  });
  const plain = triangulateAnnotationGeometry({ contour, height: 1 });
  assert.ok(near(stepped.areaRisers, 0));
  for (const key of ["areaTop", "areaBottom", "areaSides", "volume"]) {
    assert.ok(near(stepped[key], plain[key], 1e-5), key);
  }
});

test("slopes ignore the height faces", () => {
  const sloped = contour.map((p, i) => ({ ...p, offsetTop: i < 2 ? 0 : 1 }));
  const heightFaces = computeHeightFaces({ contour, traces: [pit(-0.2)] });
  const tri = triangulateAnnotationGeometry({ contour: sloped, heightFaces });
  assert.equal(tri.heightFacesApplied, undefined);
});

test("getAnnotationQties: developed surface = plan + risers", () => {
  // Drawn at 100 px per meter.
  const meterByPx = 0.01;
  const px = (p) => ({ x: p.x * 100, y: p.y * 100 });
  const points = contour.map(px);
  const trace = pit(-0.2, "TOP");
  const heightFaces = computeHeightFaces({
    contour: points,
    traces: [{ ...trace, points: trace.points.map(px) }],
    scale: meterByPx,
  });

  const sheet = getAnnotationQties({
    annotation: { type: "POLYGON", points, heightFaces },
    meterByPx,
  });
  assert.ok(near(sheet.surface, 40, 1e-4));
  assert.ok(near(sheet.surfaceDeveloped, 40 + 1.6, 1e-4));

  const prism = getAnnotationQties({
    annotation: { type: "POLYGON", points, height: 1, heightFaces },
    meterByPx,
  });
  assert.ok(near(prism.surface, 40, 1e-4));
  assert.ok(near(prism.surfaceDeveloped, 40 + 40 + 28 + 1.6, 1e-4));

  const plain = getAnnotationQties({
    annotation: { type: "POLYGON", points, height: 1 },
    meterByPx,
  });
  assert.ok(near(plain.surfaceDeveloped, 108, 1e-4));
});
