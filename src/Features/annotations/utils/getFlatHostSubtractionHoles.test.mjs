import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");

const bundle = await build({
  stdin: {
    contents: `export { default } from "./getFlatHostSubtractionHoles.js";`,
    resolveDir: here,
    loader: "js",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  alias: { Features: path.join(root, "src/Features") },
  logLevel: "silent",
});
const { default: getFlatHostSubtractionHoles } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const rect = (id, x0, y0, x1, y1, extra = {}) => ({
  id,
  type: "POLYGON",
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
  ...extra,
});

const ringArea = (ring) =>
  Math.abs(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0)
  ) / 2;

const host = rect("host", 0, 0, 100, 200);
const holes = (targets, annotation = host) =>
  getFlatHostSubtractionHoles({ annotation, targets, meterByPx: 0.01 });

test("a target inside the host opens its footprint", () => {
  const rings = holes([rect("t", 20, 40, 60, 100)]);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 4);
  assert.ok(Math.abs(ringArea(rings[0]) - 2400) < 1e-6);
});

test("a target sticking out is clipped to the host", () => {
  const rings = holes([rect("t", 80, 40, 150, 100)]);
  assert.equal(rings.length, 1);
  assert.ok(Math.abs(ringArea(rings[0]) - 20 * 60) < 1e-6);
});

test("overlapping targets open one hole", () => {
  const rings = holes([rect("a", 20, 20, 60, 60), rect("b", 40, 40, 80, 80)]);
  assert.equal(rings.length, 1);
  assert.ok(Math.abs(ringArea(rings[0]) - (1600 + 1600 - 400)) < 1e-6);
});

test("a target outside, or no target, opens nothing", () => {
  assert.deepEqual(holes([rect("t", 300, 300, 400, 400)]), []);
  assert.deepEqual(holes([]), []);
});

test("a block instance opens its precomputed footprint", () => {
  const instance = {
    id: "i",
    type: "BLOCK_INSTANCE",
    _footprintMultiPolygon: [
      [
        [
          [10, 10],
          [30, 10],
          [30, 30],
          [10, 30],
          [10, 10],
        ],
      ],
    ],
  };
  const rings = holes([instance]);
  assert.equal(rings.length, 1);
  assert.ok(Math.abs(ringArea(rings[0]) - 400) < 1e-6);
});
