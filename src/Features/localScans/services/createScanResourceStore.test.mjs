import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import createStore from "./createScanResourceStore.js";

test("scans are project resources with local Blob files and independent placement", async () => {
  const db = new Dexie("scan-resource-test");
  db.version(1).stores({ resources: "id,projectId", files: "fileName" });
  let id = 0;
  const store = createStore(db, () => String(++id));
  const source = new File(["ply test"], "test.ply");
  const data = {
    count: 3,
    kind: "POINTS",
    bounds: { min: [0, 0, 0], max: [1, 2, 3] },
  };
  const row = await store.save({
    projectId: "p1",
    file: source,
    data,
    placement: { scale: 1, yaw: 0 },
    legacyKey: "old-scope",
  });
  assert.equal(row.visibility, "PROJECT");
  assert.equal(row.scopeId, null);
  assert.equal((await store.list("p1")).length, 1);
  assert.equal((await store.list("p2")).length, 0);
  const storedFile = await db.files.get(row.fileName);
  assert.equal(storedFile.fileArrayBuffer, undefined);
  assert.equal(storedFile.listingId, undefined);
  assert.equal(await (await store.source(row)).text(), "ply test");
  await store.place(row.id, { scale: 2, origin: [3, 4, 5], yaw: 32 });
  const updated = await db.resources.get(row.id);
  assert.equal(updated.scan.count, 3);
  assert.equal(updated.scan.placement.yaw, 32);
  assert.equal(updated.legacyScanKey, "old-scope");
  assert.equal(await (await store.source(row)).text(), "ply test");
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    store.save({ projectId: "p1", file: source, data, signal: abort.signal })
  );
  assert.equal(await db.resources.count(), 1);
  assert.equal(await db.files.count(), 1);
  await db.files.delete(row.fileName);
  assert.equal(await store.source(row), null);
  await db.resources.update(row.id, { deletedAt: "now" });
  assert.equal((await store.list("p1")).length, 0);
  await assert.rejects(store.place(row.id, { yaw: 10 }));
  await db.delete();
});
