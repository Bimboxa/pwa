// Headless build of a host carved by subtractions, with the REAL 3D builders
// and the live carve's boolean (subtractAnnotationGeometries).
// Run: node src/Features/meshPaint/services/buildHeadlessHostParts.test.mjs
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
      export { default as buildHeadlessHostParts, buildHeadlessCarvedHostParts } from "Features/meshPaint/services/buildHeadlessHostParts";
      export { default as isOpenSidePrism } from "Features/annotations/utils/isOpenSidePrism";
      export { default as isHollowSubtractionHost } from "Features/annotations/utils/isHollowSubtractionHost";
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
const {
  buildHeadlessHostParts,
  buildHeadlessCarvedHostParts,
  isOpenSidePrism,
  isHollowSubtractionHost,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// --- fixture ---------------------------------------------------------------
// Plan: 1000 px square, 1 px = 1 cm. Host: a 4 m × 2 m slab, 1 m high (z from
// 0 to 1). Cutter: a 1 m × 1 m « Fosse » standing ON the slab (z from 1 to
// 1.5): its bottom face lies in the plane of the slab's top face.
const plan = {
  id: "bmPlan",
  orientation: "HORIZONTAL",
  angleDeg: 0,
  position: { x: 0, y: 0, z: 0 },
  image: { imageSize: { width: 1000, height: 1000 } },
  meterByPx: 0.01,
};
const slab = {
  id: "slab",
  type: "POLYGON",
  baseMapId: "bmPlan",
  fillColor: "#007591",
  height: 1,
  offsetZ: 0,
  points: [
    { id: "a", x: 300, y: 400 },
    { id: "b", x: 700, y: 400 },
    { id: "c", x: 700, y: 600 },
    { id: "d", x: 300, y: 600 },
  ],
};
// the same slab without its a → b side face (« Masquer le segment »)
const openSlab = {
  ...slab,
  id: "openSlab",
  hiddenSegmentsIdx: [0],
  hiddenSegmentsPointIds: ["a"],
};
const pit = {
  id: "pit",
  type: "POLYGON",
  baseMapId: "bmPlan",
  fillColor: "#e85426",
  height: 0.5,
  offsetZ: 1,
  shape3D: { key: "FOSSE" },
  points: [
    { id: "p", x: 450, y: 450 },
    { id: "q", x: 550, y: 450 },
    { id: "r", x: 550, y: 550 },
    { id: "s", x: 450, y: 550 },
  ],
};

const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
const loopArea = (loop) => {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
};
// the up-facing island at z = 1 (the slab's top face)
const topFace = (index) =>
  index.islands.find(
    (island) =>
      Math.abs(island.normal.z) > 0.99 &&
      island.polygons[0].contour.every((p) => near(p.z, 1))
  );
const faceArea = (island) =>
  island.polygons.reduce(
    (sum, polygon) =>
      sum +
      loopArea(polygon.contour) -
      polygon.holes.reduce((s, hole) => s + loopArea(hole), 0),
    0
  );
const carve = (host) =>
  buildHeadlessCarvedHostParts({
    annotation: host,
    baseMap: plan,
    subtractionTargets: [{ annotation: pit, baseMap: plan }],
  });

test("isOpenSidePrism: a prism with a hidden segment is an open surface", () => {
  assert.equal(isOpenSidePrism(openSlab), true);
  assert.equal(isOpenSidePrism(slab), false);
  // no height: a flat polygon, nothing to open
  assert.equal(isOpenSidePrism({ ...openSlab, height: 0 }), false);
  // hidden segment on a cut
  assert.equal(
    isOpenSidePrism({ ...slab, cuts: [{ hiddenSegmentsIdx: [1] }] }),
    true
  );
  assert.equal(isOpenSidePrism({ ...openSlab, type: "POLYLINE" }), false);
  assert.equal(isOpenSidePrism({ ...openSlab, isMesh3d: true }), false);
  // a subtraction host: clipped, not carved as a solid
  assert.equal(isHollowSubtractionHost(openSlab), true);
  assert.equal(isHollowSubtractionHost(slab), false);
});

test("open prism host: a cutter glued to a face clips it", async () => {
  const plain = buildHeadlessHostParts({ annotation: openSlab, baseMap: plan });
  const carved = await carve(openSlab);
  assert.ok(plain?.index && carved?.index);
  assert.equal(plain.index.isClosed, false);
  // top, bottom and 3 side faces — before and after
  assert.equal(plain.index.islands.length, 5);
  assert.equal(carved.index.islands.length, 5);
  assert.ok(near(faceArea(topFace(plain.index)), 8));
  const top = topFace(carved.index);
  assert.equal(top.polygons.length, 1);
  assert.equal(top.polygons[0].holes.length, 1);
  assert.ok(near(faceArea(top), 7), `top area ${faceArea(top)}`);
  assert.notEqual(carved.hash, plain.hash);
  plain.dispose();
  carved.dispose();
});

test("closed prism host: a cutter that only touches it removes nothing", async () => {
  const carved = await carve(slab);
  assert.ok(carved?.index);
  const top = topFace(carved.index);
  assert.ok(near(faceArea(top), 8), `top area ${faceArea(top)}`);
  assert.equal(top.polygons[0].holes.length, 0);
  carved.dispose();
});

test("no cutter: same parts as the plain build", async () => {
  const plain = buildHeadlessHostParts({ annotation: openSlab, baseMap: plan });
  const carved = await buildHeadlessCarvedHostParts({
    annotation: openSlab,
    baseMap: plan,
    subtractionTargets: [],
  });
  assert.equal(carved.hash, plain.hash);
  plain.dispose();
  carved.dispose();
});
