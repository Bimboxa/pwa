import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
);

// Browser globals some transitive modules touch at import time.
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
globalThis.document ??= {
  createElement: () => ({ getContext: () => null, style: {} }),
  createElementNS: () => ({ style: {} }),
};
globalThis.addEventListener ??= () => {};
globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };

// Bundle the real detection with its own copy of three. The builders reach
// Dexie and the MUI theme through transitive imports: both are stubbed (the
// detection itself reads neither for plain POLYGON prisms).
const bundle = await build({
  stdin: {
    contents: `
      export { default as getHostsCutByAnnotationAsync } from "Features/threedEditor/js/utilsAnnotationsManager/getHostsCutByAnnotationAsync";
      export { default as createAnnotationObject3D } from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
      export { default as createBaseMapFrameGroup } from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
      export { default as getBaseMapForRender } from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
      export { default as getBaseMapTransform } from "Features/baseMaps/js/getBaseMapTransform";
      export * as THREE from "three";
    `,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  logLevel: "silent",
  define: { "import.meta.env": '{"BASE_URL":"/"}' },
  loader: { ".jsx": "jsx", ".png": "dataurl", ".svg": "dataurl" },
  plugins: [
    {
      name: "aliases",
      setup(b) {
        b.onResolve({ filter: /^App\/db\/db$/ }, () => ({
          path: "db-stub",
          namespace: "stub",
        }));
        b.onResolve({ filter: /^@mui\/material\/styles$/ }, () => ({
          path: "mui-stub",
          namespace: "stub",
        }));
        b.onLoad({ filter: /^db-stub$/, namespace: "stub" }, () => ({
          contents:
            "const db = new Proxy({}, { get: () => ({}) }); export default db; export const withSystemWrite = (fn) => fn(); export const withHardDelete = (fn) => fn();",
          loader: "js",
        }));
        b.onLoad({ filter: /^mui-stub$/, namespace: "stub" }, () => ({
          contents:
            "export const lighten = (c) => c; export const darken = (c) => c; export const alpha = (c) => c; export const createTheme = (t) => t ?? {};",
          loader: "js",
        }));
        b.onResolve({ filter: /^(Features|App|Styles|Data)\// }, (args) => {
          const base = path.join(root, "src", args.path);
          return {
            path: /\.(js|jsx|mjs|json|png|svg)$/.test(base)
              ? base
              : base + ".js",
          };
        });
      },
    },
  ],
});
const {
  getHostsCutByAnnotationAsync,
  createAnnotationObject3D,
  createBaseMapFrameGroup,
  getBaseMapForRender,
  getBaseMapTransform,
  THREE,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// -- fixtures --

const W = 2000;
const H = 1000;
const M = 0.01; // meterByPx → a 20 m × 10 m plan

const PLAN = {
  id: "plan",
  image: { imageSize: { width: W, height: H } },
  meterByPx: M,
  orientation: "HORIZONTAL",
  position: { x: 0, y: 0, z: 0 },
};
const SECTION = {
  id: "section",
  image: { imageSize: { width: W, height: H } },
  meterByPx: M,
  orientation: "VERTICAL",
  position: { x: 0, y: 0, z: 0 },
};
const baseMapsById = { plan: PLAN, section: SECTION };

// HORIZONTAL plan: world X = (px - W/2)·M, world Z = (py - H/2)·M, world Y =
// the altitude (offsetZ + height).
const toPlanPx = (x, z) => ({ x: W / 2 + x / M, y: H / 2 + z / M });

let pointSeq = 0;
function rect({
  id,
  baseMapId = "plan",
  cx,
  cz,
  size,
  offsetZ,
  height,
  ...rest
}) {
  const half = size / 2;
  const corners = [
    [cx - half, cz - half],
    [cx + half, cz - half],
    [cx + half, cz + half],
    [cx - half, cz + half],
  ];
  return {
    id,
    type: "POLYGON",
    baseMapId,
    fillColor: "#007591",
    fillOpacity: 0.8,
    strokeColor: "#e85426",
    offsetZ,
    height,
    points: corners.map(([x, z]) => ({
      id: `p${pointSeq++}`,
      ...toPlanPx(x, z),
      type: "square",
      offsetBottom: 0,
      offsetTop: 0,
    })),
    ...rest,
  };
}

// World bounding box of an annotation built in its base map frame.
function getWorldBox(annotation) {
  const baseMap = baseMapsById[annotation.baseMapId];
  const object = createAnnotationObject3D(
    annotation,
    getBaseMapForRender(baseMap),
    { antiAliasingShrink: false }
  );
  const frame = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
  frame.add(object);
  frame.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(frame);
}

// A 6 m × 6 m slab, 0.3 m thick, top face at altitude 0.
const slab = rect({
  id: "slab",
  cx: 0,
  cz: 0,
  size: 6,
  offsetZ: -0.3,
  height: 0.3,
});

const detect = (cutter, hosts) =>
  getHostsCutByAnnotationAsync({ cutter, hosts, baseMapsById });

// -- tests --

test("a pit sunk into a slab is detected as cutting it", async () => {
  const pit = rect({
    id: "pit",
    cx: 1,
    cz: 1,
    size: 0.4,
    offsetZ: -0.2,
    height: 0.2,
    shape3D: { key: "FOSSE" },
  });
  const hits = await detect(pit, [slab]);
  assert.deepEqual(
    hits.map((hit) => hit.annotation.id),
    ["slab"]
  );
  // 0.4 × 0.4 × 0.2 m³ removed from the closed slab.
  assert.ok(Math.abs(hits[0].removed - 0.032) < 1e-3, `${hits[0].removed}`);
});

test("the same pit pasted beside the slab cuts nothing", async () => {
  const pit = rect({
    id: "pit",
    cx: 8,
    cz: 1,
    size: 0.4,
    offsetZ: -0.2,
    height: 0.2,
    shape3D: { key: "FOSSE" },
  });
  assert.deepEqual(await detect(pit, [slab]), []);
});

test("a solid merely resting on the slab does not carve it", async () => {
  const block = rect({
    id: "block",
    cx: 1,
    cz: 1,
    size: 0.4,
    offsetZ: 0,
    height: 0.5,
  });
  assert.deepEqual(await detect(block, [slab]), []);
});

test("only the hosts really reached are returned", async () => {
  const farSlab = rect({
    id: "farSlab",
    cx: 7,
    cz: -2,
    size: 2,
    offsetZ: -0.3,
    height: 0.3,
  });
  const pit = rect({
    id: "pit",
    cx: -1,
    cz: 2,
    size: 0.4,
    offsetZ: -0.2,
    height: 0.2,
  });
  const hits = await detect(pit, [farSlab, slab]);
  assert.deepEqual(
    hits.map((hit) => hit.annotation.id),
    ["slab"]
  );
});

test("a pit of the plan cuts a wall drawn on a vertical base map", async () => {
  // A wall authored on the section: its world box tells where it stands.
  const wall = rect({
    id: "wall",
    baseMapId: "section",
    cx: 2,
    cz: 1,
    size: 3,
    offsetZ: -0.25,
    height: 0.5,
  });
  const box = getWorldBox(wall);
  const center = box.getCenter(new THREE.Vector3());
  // A plan pit centred on the wall's world centre, spanning its altitude.
  const pit = rect({
    id: "pit",
    cx: center.x,
    cz: center.z,
    size: 0.2,
    offsetZ: center.y - 0.1,
    height: 0.2,
  });
  const hits = await detect(pit, [wall]);
  assert.deepEqual(
    hits.map((hit) => hit.annotation.id),
    ["wall"]
  );

  // Moved 5 m along world X, out of the wall: no contact any more.
  const movedPit = rect({
    id: "pit",
    cx: box.max.x + 5,
    cz: center.z,
    size: 0.2,
    offsetZ: center.y - 0.1,
    height: 0.2,
  });
  assert.deepEqual(await detect(movedPit, [wall]), []);
});
