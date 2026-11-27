import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

// Bundle the real parser and clipboard builder (aliased imports resolved here).
const bundle = await build({
  stdin: {
    contents: `export {default as parse} from "Features/importAnnotations/utils/parseImportAnnotationsJson";
export {default as prepare} from "Features/importAnnotations/utils/buildImportData";`,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "app-test",
      setup(b) {
        b.onResolve({ filter: /^Styles\/theme$/ }, () => ({
          path: "theme",
          namespace: "theme",
        }));
        b.onLoad({ filter: /.*/, namespace: "theme" }, () => ({
          contents: "export default {palette:{secondary:{main:'#000'}}}",
        }));
        b.onResolve({ filter: /^Features\// }, (args) => ({
          path: path.join(root, "src", args.path + ".js"),
        }));
      },
    },
  ],
});
const { parse, prepare } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// A hydrated row as copied by the single-selection debug button.
const bareRow = (overrides = {}) => ({
  id: "a1",
  type: "POLYGON",
  drawingShape: "POLYGON",
  listingId: "l1",
  baseMapId: "bm-source",
  baseMapName: "Toiture",
  annotationTemplateId: "tpl1",
  closeLine: true,
  fillColor: "#37474f",
  annotationTemplateProps: { label: "Surface courante", fillColor: "#37474f" },
  points: [
    { id: "p1", type: "square", x: 800, y: 700, offsetBottom: 0, offsetTop: 0 },
    {
      id: "p2",
      type: "square",
      x: 1800,
      y: 700,
      offsetBottom: 0,
      offsetTop: 0,
    },
    {
      id: "p3",
      type: "circle",
      x: 1800,
      y: 1400,
      offsetBottom: 0,
      offsetTop: 0,
    },
    {
      id: "p4",
      type: "square",
      x: 800,
      y: 1400,
      offsetBottom: 0,
      offsetTop: 0,
    },
  ],
  cuts: [
    {
      id: "c1",
      points: [
        { id: "c1a", x: 1000, y: 800 },
        { id: "c1b", x: 1100, y: 800 },
        { id: "c1c", x: 1100, y: 900 },
      ],
    },
  ],
  ...overrides,
});

const targetBaseMap = (meterByPx) => ({
  id: "bm-target",
  getImageSize: () => ({ width: 4000, height: 3000 }),
  getMeterByPx: () => meterByPx,
});

function build1(data, { widthMeters, meterByPx = null } = {}) {
  return prepare({
    data,
    widthMeters,
    mainBaseMap: targetBaseMap(meterByPx),
    projectId: "p",
    listingId: "l",
    relativeToBaseMap: false,
    templateIdMap: new Map([["tpl1", "tpl1"]]),
  });
}

test("a bare annotation row is parsed as a dump", () => {
  const res = parse(JSON.stringify(bareRow()));
  assert.equal(res.ok, true);
  const { data } = res;
  assert.equal(data.kind, "DUMP");
  assert.equal(data.imageSizeSynthetic, true);
  assert.equal(data.sourceBaseMapId, "bm-source");
  assert.equal(data.sourceBaseMapName, "Toiture");
  assert.equal(data.sourceListingId, "l1");
  assert.equal(data.annotations.length, 1);
  assert.equal(data.annotations[0].cuts.length, 1);
  assert.equal(data.annotationTemplates[0].label, "Surface courante");
});

test("a bare row keeps its source pixels and exposes its top-left corner", () => {
  const { data } = parse(JSON.stringify(bareRow()));
  const { clipboard, sourceTopLeft } = build1(data);
  const [item] = clipboard.items;
  const round = (p) => [Math.round(p.x), Math.round(p.y)];
  assert.deepEqual(item.basePoints.map(round), [
    [800, 700],
    [1800, 700],
    [1800, 1400],
    [800, 1400],
  ]);
  assert.deepEqual(round(item.baseCuts[0].points[2]), [1100, 900]);
  assert.equal(item.annotation.points[2].type, "circle");
  assert.deepEqual(round(sourceTopLeft), [800, 700]);
  assert.deepEqual(round(clipboard.sourceCenter), [1300, 1050]);
});

test("a bare row is rescaled to the target scale when the source scale is known", () => {
  const { data } = parse(JSON.stringify(bareRow()));
  // source 0.02 m/px, target 0.01 m/px → twice as many pixels
  const { clipboard, sourceTopLeft } = build1(data, {
    widthMeters: 0.02 * data.image.width,
    meterByPx: 0.01,
  });
  const p = clipboard.items[0].basePoints[1];
  assert.deepEqual([Math.round(p.x), Math.round(p.y)], [3600, 1400]);
  assert.deepEqual(
    [Math.round(sourceTopLeft.x), Math.round(sourceTopLeft.y)],
    [1600, 1400]
  );
});

test("an array of bare rows is accepted; mixed base maps name no source", () => {
  const res = parse(
    JSON.stringify([bareRow(), bareRow({ id: "a2", baseMapId: "other" })])
  );
  assert.equal(res.ok, true);
  assert.equal(res.data.annotations.length, 2);
  assert.equal(res.data.sourceBaseMapId, null);
});

test("the multi-selection dump keeps its real image size", () => {
  const res = parse(
    JSON.stringify({
      imageSize: { width: 2000, height: 1000 },
      meterByPx: 0.01,
      annotations: [bareRow()],
    })
  );
  assert.equal(res.ok, true);
  assert.equal(res.data.imageSizeSynthetic, false);
  assert.deepEqual(res.data.image, {
    width: 2000,
    height: 1000,
    widthMeters: 20,
  });
  assert.equal(res.data.sourceBaseMapId, "bm-source");
  // the envelope without imageSize is still rejected
  assert.equal(parse(JSON.stringify({ annotations: [bareRow()] })).ok, false);
});
