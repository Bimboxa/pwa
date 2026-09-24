import { prepareAnnotationBatchFrame } from "./prepareAnnotationBatchFrame.js";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAnnotationBatch,
  restoreAnnotationBatch,
  computeAnnotationPatch,
  matchesAnnotation,
  effectiveAnnotation,
} from "./annotationBatchService.js";
const context = { projectId: "p", scopeId: "s" };
const frame = {
  imageKey: "frame",
  meterByPx: 0.01,
  refSize: { width: 100, height: 100 },
};
const base = {
  projectId: "p",
  listingId: "l",
  baseMapId: "b",
  type: "STRIP",
  annotationTemplateId: "t",
  isExt: false,
  strokeWidth: 8,
  strokeWidthUnit: "CM",
  strokeColor: "#808080",
};
let sequence = 0;
async function fixture(t) {
  const db = new Dexie(`batch-test-${sequence++}`);
  db.version(1).stores({
    annotations: "id,listingId",
    annotationTemplates: "id",
    listings: "id",
    baseMaps: "id",
    baseMapVersions: "id,baseMapId",
    annotationBatchReceipts: "jobId",
  });
  await db.listings.put({ id: "l", projectId: "p", scopeId: "s" });
  await db.baseMaps.put({ id: "b", projectId: "p" });
  await db.annotationTemplates.put({
    id: "t",
    projectId: "p",
    listingId: "l",
    label: "Murs",
    type: "STRIP",
    overrideFields: [],
  });
  await db.annotations.bulkPut([
    { ...base, id: "a" },
    { ...base, id: "b", isExt: true },
    { ...base, id: "c", hidden: true },
  ]);
  const history = [];
  db.annotations.hook("updating", (mods, key, row, tx) => {
    if (!tx.annotationBatch) history.push(key);
    return { updatedAt: `revision-${sequence++}` };
  });
  t.after(() => db.delete());
  const job = (id, command) => ({
    jobId: id,
    snapshot: { ...context, baseMapId: "b" },
    listing: { id: "l" },
    payload: { annotationBatch: { version: 1, frame, ...command } },
  });
  const run = (id, command, ctx = context) =>
    applyAnnotationBatch(db, job(id, command), ctx, async () => frame);
  const query = (id, filter = {}) => run(id, { kind: "query", filter });
  const update = (id, groups) => run(id, { kind: "update", groups });
  const group = (id, operations) => ({ selectionId: id, operations });
  return { db, job, run, query, update, group, history };
}

test("two wall groups commit together; replay, single-use selections and one batch undo/redo", async (t) => {
  const f = await fixture(t);
  const q1 = await f.query("q1", { isExt: false });
  const q2 = await f.query("q2", { isExt: true });
  assert.equal(q1.count, 1);
  assert.equal(q2.count, 1);
  const groups = [
    f.group("q1", [{ op: "set", values: { height: 2 } }]),
    f.group("q2", [{ op: "set", values: { height: 2.37 } }]),
  ];
  const result = await f.update("u", groups);
  assert.equal(result.updatedCount, 2);
  assert.equal((await f.db.annotations.get("a")).height, 2);
  assert.equal((await f.db.annotations.get("b")).height, 2.37);
  assert.equal((await f.db.annotations.get("c")).height, undefined);
  assert.deepEqual(f.history, []);
  assert.equal((await f.update("u", groups)).replayed, true);
  await assert.rejects(f.update("u2", groups), /SELECTION_ALREADY_USED/);
  await restoreAnnotationBatch(f.db, "u", "undo", context);
  assert.equal(Object.hasOwn(await f.db.annotations.get("a"), "height"), false);
  await restoreAnnotationBatch(f.db, "u", "redo", context);
  assert.equal((await f.db.annotations.get("a")).height, 2);
  await f.run("undo-job", { kind: "undo", undoOf: "u" });
  assert.equal((await f.db.annotations.get("b")).height, undefined);
  assert.equal(
    (await f.run("undo-job", { kind: "undo", undoOf: "u" })).replayed,
    true
  );
});

test("relative offsets apply once and preserve distinct initial values", async (t) => {
  const f = await fixture(t);
  await f.db.annotations.update("b", { offsetZ: 0.5 });
  await f.query("q");
  const groups = [
    f.group("q", [{ op: "increment", field: "offsetZ", value: -1 }]),
  ];
  await f.update("u", groups);
  await f.update("u", groups);
  assert.equal((await f.db.annotations.get("a")).offsetZ, -1);
  assert.equal((await f.db.annotations.get("b")).offsetZ, -0.5);
  await assert.rejects(
    f.update("u", [
      f.group("q", [{ op: "increment", field: "offsetZ", value: -2 }]),
    ]),
    /JOB_PAYLOAD_CHANGED/
  );
});

test("stale rows or templates reject the whole batch before writes", async (t) => {
  const f = await fixture(t);
  await f.query("q");
  await f.db.annotations.update("b", { height: 4 });
  await assert.rejects(
    f.update("u", [f.group("q", [{ op: "set", values: { height: 2 } }])]),
    /ANNOTATION_CHANGED/
  );
  assert.equal((await f.db.annotations.get("a")).height, undefined);
  assert.equal(await f.db.annotationBatchReceipts.get("u"), undefined);
  await f.query("q2");
  await f.db.annotationTemplates.update("t", { label: "Changed" });
  await assert.rejects(
    f.update("u2", [f.group("q2", [{ op: "set", values: { height: 2 } }])]),
    /ANNOTATION_CHANGED/
  );
});

test("locked fields and overlapping selections fail atomically", async (t) => {
  const f = await fixture(t);
  await f.db.annotationTemplates.update("t", {
    overrideFields: ["height"],
    height: 3,
  });
  const q = await f.query("q");
  assert.equal(q.samples[0].height, 3);
  assert.deepEqual(q.samples[0].lockedFields, ["height"]);
  await assert.rejects(
    f.update("u", [f.group("q", [{ op: "set", values: { height: 2 } }])]),
    /LOCKED_FIELD/
  );
  await f.query("q2");
  await assert.rejects(
    f.update("u2", [
      f.group("q", [{ op: "set", values: { isExt: true } }]),
      f.group("q2", [{ op: "set", values: { isExt: true } }]),
    ]),
    /OVERLAPPING_SELECTIONS/
  );
  assert.equal((await f.db.annotations.get("a")).isExt, false);
});

test("permission failure on a later write rolls back every row and receipt", async (t) => {
  const f = await fixture(t);
  await f.query("q");
  f.db.annotations.hook("updating", (mods, key) => {
    if (key === "b") throw new Error("OWNERSHIP_DENIED");
  });
  await assert.rejects(
    f.update("u", [f.group("q", [{ op: "set", values: { height: 2 } }])]),
    /OWNERSHIP_DENIED/
  );
  assert.equal((await f.db.annotations.get("a")).height, undefined);
  assert.equal(await f.db.annotationBatchReceipts.get("u"), undefined);
  assert.equal(
    (await f.db.annotationBatchReceipts.get("q")).consumedBy,
    undefined
  );
});

test("scope and frame changes, missing rows, and undo conflicts fail closed", async (t) => {
  const f = await fixture(t);
  await f.query("q");
  const groups = [f.group("q", [{ op: "set", values: { height: 2 } }])];
  await assert.rejects(
    f.run("u", { kind: "update", groups }, { ...context, scopeId: "other" }),
    /BATCH_CONTEXT_CHANGED/
  );
  await assert.rejects(
    applyAnnotationBatch(
      f.db,
      f.job("u", { kind: "update", groups }),
      context,
      async () => ({ ...frame, meterByPx: 0.02 })
    ),
    /BATCH_FRAME_CHANGED/
  );
  await f.update("u", groups);
  await f.db.annotations.update("a", { height: 5 });
  await assert.rejects(
    restoreAnnotationBatch(f.db, "u", "undo", context),
    /ANNOTATION_CHANGED/
  );
  assert.equal((await f.db.annotations.get("b")).height, 2);
  await f.query("q2");
  await f.db.annotations.delete("b");
  await assert.rejects(
    f.update("u2", [f.group("q2", [{ op: "set", values: { height: 3 } }])]),
    /ANNOTATION_CHANGED/
  );
});

test("physical widths, unknown exterior values, hidden annotations and deterministic colors", () => {
  assert.equal(
    matchesAnnotation(base, null, { thicknessLessThanMeters: 0.1 }, 0.01),
    true
  );
  assert.equal(
    matchesAnnotation(
      { ...base, strokeWidth: 10 },
      null,
      { thicknessLessThanMeters: 0.1 },
      0.01
    ),
    false
  );
  assert.equal(
    matchesAnnotation(
      { ...base, strokeWidth: 8, strokeWidthUnit: "PX" },
      null,
      { thicknessLessThanMeters: 0.1 },
      0.01
    ),
    true
  );
  assert.throws(
    () =>
      matchesAnnotation(
        { ...base, strokeWidthUnit: "PX" },
        null,
        { thicknessLessThanMeters: 0.1 },
        null
      ),
    /TARGET_NOT_CALIBRATED/
  );
  assert.equal(
    matchesAnnotation(
      { ...base, isExt: undefined },
      null,
      { isExt: false },
      0.01
    ),
    false
  );
  assert.equal(
    matchesAnnotation(
      { ...base, hidden: true },
      null,
      { includeHidden: true },
      0.01
    ),
    true
  );
  assert.equal(
    effectiveAnnotation(base, { overrideFields: ["isExt"], isExt: true }).isExt,
    true
  );
  assert.deepEqual(
    computeAnnotationPatch(base, null, [
      { op: "lighten", field: "strokeColor" },
    ]),
    { strokeColor: "#939393" }
  );
  assert.throws(
    () =>
      computeAnnotationPatch(base, null, [
        { op: "set", values: { strokeWidth: 5 } },
      ]),
    /WIDTH_REQUIRES_UNIT/
  );
  assert.throws(
    () =>
      computeAnnotationPatch(base, null, [
        { op: "set", values: { height: -1 } },
      ]),
    /INVALID_VALUE/
  );
  assert.throws(
    () =>
      computeAnnotationPatch(base, null, [
        { op: "set", values: { points: [] } },
      ]),
    /UNSUPPORTED_FIELD/
  );
});

test("selection samples do not truncate targets and empty matches do not write", async (t) => {
  const f = await fixture(t);
  await f.db.annotations.bulkPut(
    Array.from({ length: 30 }, (_, i) => ({ ...base, id: `wall-${i}` }))
  );
  const q = await f.query("q");
  assert.equal(q.count, 32);
  assert.equal(q.samples.length, 20);
  const result = await f.update("u", [
    f.group("q", [{ op: "set", values: { isExt: true } }]),
  ]);
  assert.equal(result.matchedCount, 32);
  await f.query("empty", { ids: ["missing"] });
  assert.equal(
    (
      await f.update("u2", [
        f.group("empty", [{ op: "set", values: { height: 2 } }]),
      ])
    ).updatedCount,
    0
  );
});

test("missing target metadata and unloaded active context are not reported as a changed plan", async (t) => {
  const f = await fixture(t);
  const job = f.job("incomplete", { kind: "query", filter: {} });
  delete job.snapshot.scopeId;
  await assert.rejects(
    applyAnnotationBatch(f.db, job, context, async () => frame),
    (error) =>
      error.code === "BATCH_TARGET_INCOMPLETE" &&
      error.message.includes("scopeId")
  );
  await assert.rejects(
    f.run("not-ready", { kind: "query", filter: {} }, { projectId: "p" }),
    (error) => error.code === "BATCH_CONTEXT_NOT_READY"
  );
  assert.equal(await f.db.annotationBatchReceipts.count(), 0);
  await assert.rejects(
    f.run(
      "changed",
      { kind: "query", filter: {} },
      { ...context, scopeId: "other" }
    ),
    (error) =>
      error.code === "BATCH_CONTEXT_CHANGED" &&
      error.message.includes("scopeId")
  );
});

test("frame errors identify calibration versus image-version differences", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    applyAnnotationBatch(
      f.db,
      f.job("frame", { kind: "query", filter: {} }),
      context,
      async () => ({ ...frame, meterByPx: 0.02 })
    ),
    (error) =>
      error.code === "BATCH_FRAME_CHANGED" &&
      error.message ===
        "BATCH_FRAME_CHANGED: meterByPx (published=0.01, current=0.02)"
  );
});

test("batch frame uses publication's hydrated dimensions, not stale raw image metadata", async (t) => {
  const f = await fixture(t);
  await f.db.baseMaps.update("b", {
    image: { fileName: "plan.png", imageSize: { width: 50, height: 50 } },
  });
  const readFrame = await prepareAnnotationBatchFrame(
    f.db,
    "b",
    async (record) => {
      assert.equal(
        Dexie.currentTransaction,
        null,
        "image hydration must not run in a transaction"
      );
      // ImageObject recomputes these from actual image bytes during publication.
      return {
        ...record,
        image: { ...record.image, imageSize: { width: 100, height: 100 } },
      };
    },
    (baseMap) => ({
      imageKey: "frame",
      meterByPx: 0.01,
      refWidth: baseMap.image.imageSize.width,
      refHeight: baseMap.image.imageSize.height,
    })
  );
  const result = await applyAnnotationBatch(
    f.db,
    f.job("loaded-query", { kind: "query", filter: {} }),
    context,
    readFrame
  );
  assert.equal(result.count, 2);
  await f.update("loaded-update", [
    f.group("loaded-query", [{ op: "set", values: { height: 2 } }]),
  ]);
  assert.equal((await f.db.annotations.get("a")).height, 2);
});

test("frame preparation still detects changes made during async hydration", async (t) => {
  const f = await fixture(t);
  const readFrame = await prepareAnnotationBatchFrame(
    f.db,
    "b",
    async (record) => {
      await f.db.baseMaps.update("b", { meterByPx: 0.03 });
      return record;
    },
    () => ({
      imageKey: "frame",
      meterByPx: 0.01,
      refWidth: 100,
      refHeight: 100,
    })
  );
  await assert.rejects(
    applyAnnotationBatch(
      f.db,
      f.job("raced-query", { kind: "query", filter: {} }),
      context,
      readFrame
    ),
    /BATCH_FRAME_CHANGED: persistedSource/
  );
  assert.equal(await f.db.annotationBatchReceipts.count(), 0);
});

test("float noise does not block a batch and queries keep the published calibration", async (t) => {
  const f = await fixture(t);
  await f.db.annotations.update("a", {
    strokeWidth: 10,
    strokeWidthUnit: "PX",
  });
  const localFrame = { ...frame, meterByPx: 0.009999999999999998 };
  const readFrame = async () => localFrame;
  const queried = await applyAnnotationBatch(
    f.db,
    f.job("precision-query", {
      kind: "query",
      filter: { ids: ["a"], thicknessLessThanMeters: 0.1 },
    }),
    context,
    readFrame
  );
  // 10 PX * published 0.01 = exactly 10 cm: strict '< 10 cm' excludes it.
  // Recomputing with local float noise would incorrectly include this wall.
  assert.equal(queried.count, 0);
  assert.equal(
    (await f.db.annotationBatchReceipts.get("precision-query")).frame.meterByPx,
    0.01
  );
  await applyAnnotationBatch(
    f.db,
    f.job("height-query", { kind: "query", filter: { isExt: true } }),
    context,
    readFrame
  );
  const updated = await applyAnnotationBatch(
    f.db,
    f.job("height-update", {
      kind: "update",
      groups: [f.group("height-query", [{ op: "set", values: { height: 2 } }])],
    }),
    context,
    readFrame
  );
  assert.equal(updated.updatedCount, 1);
  assert.equal((await f.db.annotations.get("b")).height, 2);
});
