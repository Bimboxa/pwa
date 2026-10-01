import "fake-indexeddb/auto";
import Dexie from "dexie";
import test from "node:test";
import assert from "node:assert/strict";
import persistDxfImport from "./persistDxfImport.js";

function database(name) {
  const db = new Dexie(name);
  db.version(1).stores({
    baseMaps: "id",
    baseMapVersions: "id,baseMapId",
    listings: "id",
    files: "fileName",
    layers: "id",
    globalLayers: "id",
    points: "id",
    annotations: "id",
  });
  return db;
}
const records = (layersMode) => ({
  baseMap: {
    id: "map",
    fromDXF: true,
    dxf: { fileName: "source.dxf", referenceVersionId: "raster" },
  },
  listing: { id: "list" },
  versions: [
    { id: "blank", baseMapId: "map" },
    { id: "raster", baseMapId: "map" },
  ],
  files: [
    {
      fileName: "source.dxf",
      fileArrayBuffer: new TextEncoder().encode("source").buffer,
    },
  ],
  layers: [{ id: "layer" }],
  points: [{ id: "point", x: 0.5, y: 0.5 }],
  annotations: [{ id: "annotation", points: [{ id: "point" }] }],
  layersMode,
});

for (const mode of ["BASE_MAP", "GLOBAL"]) {
  test(`commits and reloads the complete ${mode} import including source bytes`, async () => {
    const db = database(`dxf-success-${mode}`);
    try {
      await persistDxfImport(db, records(mode));
      db.close();
      await db.open();
      assert.equal((await db.baseMaps.get("map")).fromDXF, true);
      assert.equal(await db.baseMapVersions.count(), 2);
      assert.equal(
        await db[mode === "GLOBAL" ? "globalLayers" : "layers"].count(),
        1
      );
      assert.equal(
        await db[mode === "GLOBAL" ? "layers" : "globalLayers"].count(),
        0
      );
      assert.equal(
        new TextDecoder().decode(
          (await db.files.get("source.dxf")).fileArrayBuffer
        ),
        "source"
      );
    } finally {
      await db.delete();
    }
  });
}

test("a late annotation write failure rolls back files, listing, map, layers and points", async () => {
  const db = database("dxf-rollback");
  try {
    const batch = records("BASE_MAP");
    batch.annotations.push({ id: "annotation" });
    await assert.rejects(persistDxfImport(db, batch));
    for (const table of db.tables)
      assert.equal(await table.count(), 0, table.name);
  } finally {
    await db.delete();
  }
});
