// Run: node src/Features/heightCuts/utils/heightCuts.test.mjs
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
const { computeHeightFaces } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 10 x 4 slab.
const contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 0, y: 4 },
];
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const sumArea = (faces) => faces.reduce((sum, f) => sum + f.area, 0);
const vLine = (id, x, y0 = -1, y1 = 5) => ({
  id,
  closeLine: false,
  points: [
    { x, y: y0 },
    { x, y: y1 },
  ],
});

test("no trace: no face", () => {
  assert.deepEqual(computeHeightFaces({ contour }), []);
});

test("inner rectangle: a pit and the main face around it", () => {
  const faces = computeHeightFaces({
    contour,
    traces: [
      {
        id: "pit",
        delta: -0.2,
        side: "BOTTOM",
        points: [
          { x: 4, y: 1 },
          { x: 6, y: 1 },
          { x: 6, y: 3 },
          { x: 4, y: 3 },
        ],
      },
    ],
  });
  assert.equal(faces.length, 2);
  const pit = faces.find((f) => f.heightCutId === "pit");
  const main = faces.find((f) => f.heightCutId == null);
  assert.equal(pit.key, "C:pit");
  assert.equal(pit.delta, -0.2);
  assert.equal(pit.side, "BOTTOM");
  assert.ok(near(pit.area, 4));
  assert.equal(main.delta, 0);
  assert.equal(main.holes.length, 1);
  assert.ok(near(main.area, 36));
  // The label of the ring-shaped main face is not in its hole.
  assert.ok(
    !(
      main.labelPoint.x > 4 &&
      main.labelPoint.x < 6 &&
      main.labelPoint.y > 1 &&
      main.labelPoint.y < 3
    )
  );
});

test("two crossing lines: a podium band selected by its seed", () => {
  const faces = computeHeightFaces({
    contour,
    traces: [vLine("a", 3), vLine("b", 5)],
    faceEntries: [{ id: "band", seed: { x: 4, y: 2 }, delta: 0.2 }],
  });
  assert.equal(faces.length, 3);
  assert.ok(near(sumArea(faces), 40));
  const band = faces.find((f) => f.faceEntryId === "band");
  assert.equal(band.key, "F:band");
  assert.equal(band.delta, 0.2);
  assert.equal(band.side, "TOP");
  assert.ok(near(band.area, 8));
  assert.ok(faces.filter((f) => f !== band).every((f) => f.delta === 0));
});

test("a line stopping inside is prolonged to the border", () => {
  const faces = computeHeightFaces({
    contour,
    traces: [vLine("a", 3, 1, 3)],
  });
  assert.equal(faces.length, 2);
  assert.ok(near(sumArea(faces), 40));
});

test("U branched on the border", () => {
  const faces = computeHeightFaces({
    contour,
    traces: [
      {
        id: "u",
        closeLine: false,
        points: [
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: 0 },
        ],
      },
    ],
  });
  assert.equal(faces.length, 2);
  const areas = faces.map((f) => f.area).sort((a, b) => a - b);
  assert.ok(near(areas[0], 4));
  assert.ok(near(areas[1], 36));
});

test("closed shape overflowing the border is clipped to the polygon", () => {
  const faces = computeHeightFaces({
    contour,
    traces: [
      {
        id: "r",
        delta: 0.5,
        points: [
          { x: 8, y: -2 },
          { x: 12, y: -2 },
          { x: 12, y: 2 },
          { x: 8, y: 2 },
        ],
      },
    ],
  });
  assert.equal(faces.length, 2);
  const raised = faces.find((f) => f.delta === 0.5);
  assert.ok(near(raised.area, 4));
  assert.ok(near(sumArea(faces), 40));
});

test("a line crossing a hole and a closed shape", () => {
  const hole = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 3 },
    { x: 1, y: 3 },
  ];
  const faces = computeHeightFaces({
    contour,
    holes: [hole],
    traces: [
      {
        id: "pit",
        delta: -0.2,
        points: [
          { x: 4, y: 1 },
          { x: 8, y: 1 },
          { x: 8, y: 3 },
          { x: 4, y: 3 },
        ],
      },
      {
        id: "h",
        closeLine: false,
        points: [
          { x: -1, y: 2 },
          { x: 11, y: 2 },
        ],
      },
    ],
  });
  // The hole stays a hole: 40 - 2.
  assert.ok(near(sumArea(faces), 38));
  // Top / bottom halves of the main face, top / bottom halves of the pit.
  assert.equal(faces.length, 4);
  assert.equal(faces.filter((f) => f.heightCutId === "pit").length, 2);
  assert.equal(new Set(faces.map((f) => f.key)).size, 4);
});

test("scale: tolerances are applied in meters", () => {
  // The same slab drawn at 100 px per meter.
  const px = (p) => ({ x: p.x * 100, y: p.y * 100 });
  const faces = computeHeightFaces({
    contour: contour.map(px),
    traces: [{ ...vLine("a", 3), points: vLine("a", 3).points.map(px) }],
    scale: 0.01,
  });
  assert.equal(faces.length, 2);
  assert.ok(near(sumArea(faces), 40 * 100 * 100, 1e-3));
});
