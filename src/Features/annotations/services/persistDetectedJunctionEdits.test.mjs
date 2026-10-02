import assert from "node:assert/strict";
import { test } from "node:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import persistDetectedJunctionEdits from "./persistDetectedJunctionEdits.js";

async function fixture() {
  const db = new Dexie(`junction-${Math.random()}`, { indexedDB, IDBKeyRange });
  db.version(1).stores({ points: "id", annotations: "id" });
  await db.points.bulkAdd([
    { id: "shared", x: 0.1, y: 0.2 },
    { id: "end", x: 0.5, y: 0.2 },
  ]);
  await db.annotations.bulkAdd([
    {
      id: "neighbor",
      baseMapId: "plan",
      projectId: "project",
      points: [{ id: "shared" }, { id: "end" }],
    },
    {
      id: "unrelated",
      baseMapId: "plan",
      points: [{ id: "shared" }, { id: "end" }],
    },
  ]);
  return db;
}
const edit = {
  annotationId: "neighbor",
  pointId: "shared",
  before: { x: 100, y: 100 },
  x: 110,
  y: 100,
};
const options = {
  edits: [edit],
  baseMapId: "plan",
  imageSize: { width: 1000, height: 500 },
  createId: () => "new-point",
};

test("junction edits persist normalized points and do not move shared neighbors", async () => {
  const db = await fixture();
  try {
    await db.transaction("rw", db.points, db.annotations, () =>
      persistDetectedJunctionEdits({ ...options, db })
    );
    assert.equal(
      (await db.annotations.get("neighbor")).points[0].id,
      "new-point"
    );
    assert.equal(
      (await db.annotations.get("unrelated")).points[0].id,
      "shared"
    );
    assert.equal((await db.points.get("shared")).x, 0.1);
    assert.deepEqual(await db.points.get("new-point"), {
      id: "new-point",
      x: 0.11,
      y: 0.2,
      baseMapId: "plan",
      projectId: "project",
    });
  } finally {
    await db.delete();
  }
});

test("a concurrent neighbor edit rolls back the whole creation transaction", async () => {
  const db = await fixture();
  try {
    await db.points.update("shared", { x: 0.2 });
    await assert.rejects(
      db.transaction("rw", db.points, db.annotations, async () => {
        await db.annotations.add({ id: "created" });
        await persistDetectedJunctionEdits({ ...options, db });
      }),
      /changed during detection/
    );
    assert.equal(await db.annotations.get("created"), undefined);
    assert.equal(await db.points.get("new-point"), undefined);
    assert.equal((await db.points.get("shared")).x, 0.2);
  } finally {
    await db.delete();
  }
});

test("a creation failure rolls back already prepared neighbor writes", async () => {
  const db = await fixture();
  try {
    await assert.rejects(
      db.transaction("rw", db.points, db.annotations, async () => {
        await persistDetectedJunctionEdits({ ...options, db });
        await db.annotations.add({ id: "neighbor" });
      })
    );
    assert.equal((await db.annotations.get("neighbor")).points[0].id, "shared");
    assert.equal(await db.points.get("new-point"), undefined);
  } finally {
    await db.delete();
  }
});
