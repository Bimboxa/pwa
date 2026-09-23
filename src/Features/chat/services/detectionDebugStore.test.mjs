import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectionArchiveKey,
  saveDetectionDebug,
  listDetectionDebug,
  MAX_DEBUG_ARTIFACTS,
} from "./detectionDebugStore.js";

function fakeDb() {
  const rows = new Map();
  const artifacts = {
    put: async (r) => rows.set(r.id, structuredClone(r)),
    bulkDelete: async (ids) => ids.forEach((id) => rows.delete(id)),
    where: () => ({
      equals: (key) => {
        const sorted = () =>
          [...rows.values()]
            .filter((r) => r.archiveKey === key)
            .sort((a, b) => a.createdAt - b.createdAt);
        return {
          sortBy: async () => sorted(),
          reverse: () => ({ sortBy: async () => sorted().reverse() }),
        };
      },
    }),
  };
  return {
    artifacts,
    transaction: async (_mode, _table, callback) => callback(),
    rows,
  };
}
test("archives exact raw output, scopes by owner/project/plan and bounds retention", async () => {
  const db = fakeDb();
  const key = detectionArchiveKey(42, "project", "plan");
  assert.equal(key, detectionArchiveKey("42", "project", "plan"));
  const other = detectionArchiveKey("other", "project", "plan");
  await saveDetectionDebug(
    { id: "other", archiveKey: other, createdAt: 0 },
    db
  );
  for (let i = 0; i < MAX_DEBUG_ARTIFACTS + 2; i++)
    await saveDetectionDebug(
      {
        id: String(i),
        archiveKey: key,
        createdAt: i,
        artifact: {
          stage: "raw_detection",
          data: { argumentsJson: '{"broken' + i },
        },
      },
      db
    );
  const rows = await listDetectionDebug(key, db);
  assert.equal(rows.length, MAX_DEBUG_ARTIFACTS);
  assert.equal(rows[0].id, String(MAX_DEBUG_ARTIFACTS + 1));
  assert.equal(rows.at(-1).id, "2");
  assert.equal((await listDetectionDebug(other, db)).length, 1);
  assert.equal(
    (
      await listDetectionDebug(
        detectionArchiveKey(42, "project", "another"),
        db
      )
    ).length,
    0
  );
  await assert.rejects(
    saveDetectionDebug({ id: "missing", archiveKey: null }, db)
  );
});
test("storage errors remain observable to keep the in-chat copy available", async () => {
  const db = fakeDb();
  db.artifacts.put = async () => {
    throw new Error("quota");
  };
  await assert.rejects(
    saveDetectionDebug({ id: "1", archiveKey: "scope" }, db),
    /quota/
  );
});
