// Headless build of block instances with the REAL 3D builders
// (createAnnotationObject3D, blockFrame helpers, getHostPartData).
// Run: node src/Features/meshPaint/services/createHeadlessBlockPrototypes.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

// browser-only globals the builders' imports touch at load time
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener: () => {},
};
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

// Only the database layer is stubbed (Dexie opens IndexedDB at import): a
// CommonJS proxy, so every named import resolves at runtime.
const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
const aliases = {
  name: "aliases",
  setup(b) {
    b.onResolve({ filter: /^(dexie|App\/db\/|App\/store)/ }, () => ({
      path: "stub",
      namespace: "stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `const p = new Proxy(function () {}, { get: (t, k) => (k === "__esModule" ? false : p), apply: () => p, construct: () => p }); module.exports = p;`,
      loader: "js",
    }));
    b.onResolve({ filter: /^(Features|App|Styles|Data)\// }, (args) => {
      const base = path.join(root, "src", args.path);
      for (const suffix of ["", ".js", ".jsx", "/index.js"]) {
        if (isFile(base + suffix)) return { path: base + suffix };
      }
      return { path: base + ".js" };
    });
  },
};
const bundle = await build({
  stdin: {
    contents: `
      export { default as createHeadlessBlockPrototypes } from "Features/meshPaint/services/createHeadlessBlockPrototypes";
      export { default as buildHeadlessHostParts } from "Features/meshPaint/services/buildHeadlessHostParts";
    `,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env": "{}" },
  loader: {
    ".js": "jsx",
    ".png": "dataurl",
    ".svg": "dataurl",
    ".glb": "dataurl",
  },
  logLevel: "error",
  plugins: [aliases],
});
const { createHeadlessBlockPrototypes, buildHeadlessHostParts } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// --- fixture ---------------------------------------------------------------
// Blocks base map: 1000 px square, 1 px = 1 cm. Block member: a 0.4 m (x) ×
// 1 m (y) slab, 0.5 m high, whose insertion point is the middle of its
// RIGHT edge (the slab extends from x = −0.4 to 0 in the block frame).
const blocksBaseMap = {
  id: "bmBlocks",
  isBlocksBaseMap: true,
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  image: { imageSize: { width: 1000, height: 1000 } },
  meterByPx: 0.01,
};
const member = {
  id: "member1",
  type: "POLYGON",
  baseMapId: "bmBlocks",
  blockId: "block1",
  fillColor: "#8491a7",
  height: 0.5,
  offsetZ: 0,
  points: [
    { id: "a", x: 460, y: 450 },
    { id: "b", x: 500, y: 450 },
    { id: "c", x: 500, y: 550 },
    { id: "d", x: 460, y: 550 },
  ],
};
const block = {
  id: "block1",
  origin: { baseMapId: "bmBlocks", x: 0.5, y: 0.5, z: 0 },
};
// Host plan: 2000 × 1000 px, 1 px = 2 cm (another scale than the block's
// page: an instance is drawn at real size).
const plan = {
  id: "bmPlan",
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  image: { imageSize: { width: 2000, height: 1000 } },
  meterByPx: 0.02,
};
const instance = (id, anchorPx, rotation, offsetZ = 0) => ({
  id,
  type: "BLOCK_INSTANCE",
  instanceOfBlockId: "block1",
  baseMapId: "bmPlan",
  bbox: { x: anchorPx.x, y: anchorPx.y, width: 0, height: 0 },
  rotation,
  offsetZ,
});

const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
// bounds of a part index in the plan's local frame, relative to an anchor
// given in plan pixels (local x = px x, local y = −px y, meters)
function bounds(index, anchorPx) {
  const ax = (anchorPx.x - 1000) * 0.02;
  const ay = -(anchorPx.y - 500) * 0.02;
  const points = index.islands.flatMap((island) =>
    island.polygons.flatMap((polygon) => polygon.contour)
  );
  const range = (values) => [Math.min(...values), Math.max(...values)];
  return {
    // right on screen / down on screen / up
    right: range(points.map((p) => p.x - ax)),
    down: range(points.map((p) => -(p.y - ay))),
    up: range(points.map((p) => p.z)),
  };
}
const assertRange = (actual, [min, max], label) => {
  assert.ok(
    near(actual[0], min) && near(actual[1], max),
    `${label}: expected [${min}, ${max}], got [${actual}]`
  );
};

const builder = createHeadlessBlockPrototypes({
  block,
  originBaseMap: blocksBaseMap,
  members: [{ annotation: member, baseMap: blocksBaseMap }],
});

test("the block builds its prototypes", () => {
  assert.ok(builder);
});

test("instance at rotation 0: the block as drawn, at real size, lifted", () => {
  const anchor = { x: 600, y: 300 };
  const built = builder.buildInstance({
    instance: instance("i0", anchor, 0, 0.45),
    baseMap: plan,
  });
  assert.ok(built?.index);
  assert.equal(built.index.isClosed, true);
  assert.equal(built.index.islands.length, 6);
  const b = bounds(built.index, anchor);
  assertRange(b.right, [-0.4, 0], "x");
  assertRange(b.down, [-0.5, 0.5], "y");
  assertRange(b.up, [0.45, 0.95], "z");
});

test("rotation is clockwise on screen (y down), like the 2D instance", () => {
  const anchor = { x: 900, y: 700 };
  // 90° clockwise: the block's +x axis points DOWN the screen — the slab
  // (x from −0.4 to 0) lies above the anchor
  const quarter = builder.buildInstance({
    instance: instance("i90", anchor, 90),
    baseMap: plan,
  });
  const q = bounds(quarter.index, anchor);
  assertRange(q.down, [-0.4, 0], "down");
  assertRange(q.right, [-0.5, 0.5], "right");
  // 180°: the slab lies on the right of the anchor
  const half = builder.buildInstance({
    instance: instance("i180", anchor, 180),
    baseMap: plan,
  });
  const h = bounds(half.index, anchor);
  assertRange(h.right, [0, 0.4], "right");
  assertRange(h.down, [-0.5, 0.5], "down");
});

test("geometry hash: stable per instance, different per placement", () => {
  const at = (id, x) =>
    builder.buildInstance({
      instance: instance(id, { x, y: 300 }, 0),
      baseMap: plan,
    }).hash;
  assert.equal(at("i1", 400), at("i1", 400));
  assert.notEqual(at("i1", 400), at("i2", 800));
});

test("an instance reads like the same solid drawn in place", () => {
  // the slab drawn directly on the plan where the instance puts it
  const anchor = { x: 600, y: 300 };
  const drawn = buildHeadlessHostParts({
    annotation: {
      ...member,
      id: "drawn",
      blockId: undefined,
      baseMapId: "bmPlan",
      offsetZ: 0.45,
      points: [
        { id: "a", x: 580, y: 275 },
        { id: "b", x: 600, y: 275 },
        { id: "c", x: 600, y: 325 },
        { id: "d", x: 580, y: 325 },
      ],
    },
    baseMap: plan,
  });
  const placed = builder.buildInstance({
    instance: instance("i0", anchor, 0, 0.45),
    baseMap: plan,
  });
  assert.equal(placed.hash, drawn.hash);
  drawn.dispose();
});

test("no origin, no member: nothing to build", () => {
  assert.equal(
    createHeadlessBlockPrototypes({
      block: { id: "b", origin: null },
      originBaseMap: blocksBaseMap,
      members: [{ annotation: member, baseMap: blocksBaseMap }],
    }),
    null
  );
  assert.equal(
    createHeadlessBlockPrototypes({
      block,
      originBaseMap: blocksBaseMap,
      members: [],
    }),
    null
  );
});
