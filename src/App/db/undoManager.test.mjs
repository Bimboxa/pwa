import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearUndo,
  forgetAnnotationBatchUndo,
  getUndoStack,
  pushUndo,
  withUndoGroup,
} from "./undoManager.js";

const entry = (key) => ({ table: "points", type: "create", key });

test("writes of an undo group are one undo step", async () => {
  clearUndo();
  await withUndoGroup(async () => {
    pushUndo(entry("a"));
    await withUndoGroup(async () => pushUndo(entry("b")));
    pushUndo(entry("c"));
  });
  const stack = getUndoStack();
  assert.equal(stack.length, 1);
  assert.equal(stack[0].type, "group");
  assert.deepEqual(
    stack[0].entries.map((e) => e.key),
    ["a", "b", "c"]
  );

  // A single write stays a plain entry; an empty group pushes nothing.
  await withUndoGroup(async () => pushUndo(entry("d")));
  await withUndoGroup(async () => {});
  assert.equal(getUndoStack().length, 2);
  assert.equal(getUndoStack()[1].key, "d");

  // The group closes even when its writes throw.
  await assert.rejects(
    withUndoGroup(async () => {
      pushUndo(entry("e"));
      throw new Error("boom");
    })
  );
  pushUndo(entry("f"));
  assert.deepEqual(
    getUndoStack()
      .slice(2)
      .map((e) => e.key),
    ["e", "f"]
  );
});

test("redo of a nested update restores the full new row (real Dexie)", async () => {
  await import("fake-indexeddb/auto");
  const { default: Dexie } = await import("dexie");
  const { registerUndoHooks, undo, redo } = await import("./undoManager.js");

  const db = new Dexie(`undo-redo-${Date.now()}`);
  db.version(1).stores({ meshPaints: "id", annotations: "id" });
  // Audit-like hook registered first, as in db.js.
  ["meshPaints", "annotations"].forEach((table) =>
    db[table].hook("updating", (mods) =>
      mods.updatedAt ? undefined : { updatedAt: new Date().toISOString() }
    )
  );
  registerUndoHooks(db, ["meshPaints", "annotations"]);

  await db.meshPaints.add({
    id: "p",
    geometry: { polygons: [[0]], normal: [0, 0, 1] },
    sync: { syncedAt: "T0", geomHash: "h0" },
  });
  clearUndo();
  await db.meshPaints.update("p", {
    geometry: { polygons: [[1]], normal: [0, 0, 1] },
    sync: { syncedAt: "T1", geomHash: "h0" },
  });

  await undo({ db });
  const undone = await db.meshPaints.get("p");
  assert.deepEqual(undone.geometry.polygons, [[0]]);
  assert.equal(undone.sync.syncedAt, "T0");

  await redo({ db });
  const redone = await db.meshPaints.get("p");
  assert.deepEqual(redone.geometry.polygons, [[1]]);
  assert.equal(redone.sync.syncedAt, "T1");
  assert.deepEqual(
    Object.keys(redone).filter((key) => key.includes(".")),
    []
  );

  // Annotations: an undo re-stamps updatedAt instead of rolling it back.
  await db.annotations.add({ id: "a", height: 2.5, updatedAt: "2000-01-01" });
  clearUndo();
  await db.annotations.update("a", { height: 3 });
  await undo({ db });
  const host = await db.annotations.get("a");
  assert.equal(host.height, 2.5);
  assert.ok(host.updatedAt > "2000-01-01");
});

test("an assistant batch never joins an open undo group", async () => {
  clearUndo();
  await withUndoGroup(async () => {
    pushUndo(entry("a"));
    pushUndo({ type: "annotation_batch", key: "job1" });
    pushUndo(entry("b"));
  });
  const stack = getUndoStack();
  assert.deepEqual(
    stack.map((e) => e.type),
    ["annotation_batch", "group"]
  );

  // forgetAnnotationBatchUndo also strips a batch nested in a group.
  clearUndo();
  pushUndo({
    type: "group",
    entries: [entry("x"), { type: "annotation_batch", key: "job2" }],
  });
  pushUndo({
    type: "group",
    entries: [{ type: "annotation_batch", key: "job2" }],
  });
  forgetAnnotationBatchUndo("job2");
  const left = getUndoStack();
  assert.equal(left.length, 1);
  assert.deepEqual(
    left[0].entries.map((e) => e.key),
    ["x"]
  );
});
