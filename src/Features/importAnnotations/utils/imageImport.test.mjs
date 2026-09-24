import "fake-indexeddb/auto";
import Dexie from "dexie";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  imagePlacement,
  decodeImageAsset,
  validateImageImport,
} from "./imageImport.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const asset = {
  id: "r",
  mime: "image/png",
  width: 1,
  height: 1,
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==",
};
const payload = () => ({
  image: { width: 1000, height: 500 },
  imageAssets: [asset],
  annotationTemplates: [{ id: "t", type: "IMAGE" }],
  annotations: [
    {
      id: "a",
      type: "IMAGE",
      annotationTemplateId: "t",
      imageAssetId: "r",
      sourceOrder: 1,
      opacity: 0.5,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.2 },
        { x: 0.1, y: 0.4 },
      ],
    },
  ],
});
// Bundle the real parser, clipboard builder and transaction service. Only the
// app singleton and visual theme are replaced; storage is real Dexie/IndexedDB.
const bundle = await build({
  stdin: {
    contents: `export {default as parse} from "Features/importAnnotations/utils/parseImportAnnotationsJson";
export {default as prepare} from "Features/importAnnotations/utils/buildImportData";
export {default as paste} from "Features/mapEditor/services/pasteAnnotationService";`,
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
        b.onResolve({ filter: /^App\/db\/db$/ }, () => ({
          path: "db",
          namespace: "test",
        }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            "export default new Proxy({}, {get(_t,key){const db=globalThis.__imageImportDb;const v=db[key];return typeof v==='function'?v.bind(db):v;}})",
        }));
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
const { parse, prepare, paste } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
let n = 0;
async function fixture(t) {
  const db = new Dexie(`image-import-${n++}`);
  db.version(1).stores({
    points: "id",
    annotations: "id",
    files: "fileName",
    relAnnotationMappingCategory: "id,annotationId",
    relAnnotationOpenings: "id",
  });
  globalThis.__imageImportDb = db;
  t.after(() => db.delete());
  const mainBaseMap = {
    id: "map",
    getImageSize: () => ({ width: 2000, height: 1000 }),
    getMeterByPx: () => 0.01,
  };
  const parsed = parse(JSON.stringify(payload()));
  assert.equal(parsed.ok, true, parsed.error);
  const prepared = prepare({
    data: parsed.data,
    projectId: "p",
    listingId: "l",
    mainBaseMap,
    relativeToBaseMap: true,
    templateIdMap: new Map([["t", "template"]]),
  });
  const run = (transform = { rotationDeg: 0, flipX: false }) =>
    paste({
      pasteClipboard: prepared.clipboard,
      pasteTransform: transform,
      targetCenter: prepared.clipboard.sourceCenter,
      baseMap: mainBaseMap,
      targetMeterByPx: 0.01,
    });
  return { db, run, prepared };
}
test("PNG validation rejects wrong bytes, duplicates, missing assets and nonrectangular placement", () => {
  assert.ok(decodeImageAsset(asset).length > 0);
  assert.equal(validateImageImport(payload()), null);
  for (const mutate of [
    (p) => p.imageAssets.push(asset),
    (p) => (p.imageAssets = []),
    (p) => (p.imageAssets = [{ ...asset, width: 2 }]),
    (p) => (p.annotations[0].points[2].x = 0.2),
  ]) {
    const p = payload();
    mutate(p);
    assert.ok(validateImageImport(p));
    assert.equal(parse(JSON.stringify(p)).ok, false);
  }
});
test("rotated and mirrored corners map to the existing bbox/rotation renderer", () => {
  const r = imagePlacement(
    [
      { x: 10, y: 20 },
      { x: 10, y: 120 },
      { x: 60, y: 20 },
    ],
    { width: 200, height: 100 }
  );
  assert.equal(r.rotation, 90);
  assert.equal(r.imageFlipY, true);
  assert.deepEqual(r.bbox, { x: -0.075, y: 0.45, width: 0.5, height: 0.5 });
});
test("real import saves native bytes and normalized geometry, survives reopen, and keeps files for annotation undo", async (t) => {
  const { db, run } = await fixture(t);
  const [a] = await run();
  assert.deepEqual(a.bbox, { x: 0.1, y: 0.2, width: 0.2, height: 0.2 });
  assert.equal(a.opacity, 0.5);
  assert.equal(a.annotationTemplateId, "template");
  assert.equal(a.points, undefined);
  assert.equal(a.image.imageUrlClient, undefined);
  assert.ok(a.orderIndex);
  const file = await db.files.get(a.image.fileName);
  assert.equal(file.listingId, "l");
  assert.equal(file.entityId, a.id);
  assert.deepEqual(
    new Uint8Array(file.fileArrayBuffer),
    decodeImageAsset(asset)
  );
  db.close();
  await db.open();
  assert.equal((await db.annotations.get(a.id)).image.fileName, file.fileName);
  await db.annotations.delete(a.id);
  assert.ok(await db.files.get(file.fileName));
  await db.annotations.put(a);
  assert.ok(
    await db.files.get((await db.annotations.get(a.id)).image.fileName)
  );
});
test("annotation write failure rolls back the PNG file in the same transaction", async (t) => {
  const { db, run } = await fixture(t);
  db.annotations.hook("creating", () => {
    throw new Error("simulated write failure");
  });
  await assert.rejects(run(), /simulated write failure/);
  assert.equal(await db.files.count(), 0);
  assert.equal(await db.annotations.count(), 0);
});
test("paste transform rotates and mirrors the raster with the vector group", async (t) => {
  const { run, prepared } = await fixture(t);
  prepared.clipboard.sourceMeterByPx = 0.02;
  const [a] = await run({ rotationDeg: 90, flipX: true });
  assert.equal(Math.abs(a.rotation), 90);
  assert.equal(a.imageFlipY, true);
  assert.equal(a.bbox.width, 0.4);
  assert.equal(a.bbox.height, 0.4);
});
