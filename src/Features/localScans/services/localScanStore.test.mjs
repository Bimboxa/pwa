import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteLocalScan,
  getLocalScan,
  getLocalScanSource,
  saveLocalScan,
  updateLocalScanPlacement,
} from "./localScanStore.js";

test("local sources are isolated by scope; placement does not rewrite source data", async () => {
  const first = new File(["first"], "first.ply");
  const second = new File(["second"], "second.ply");
  const info = { count: 2, kind: "POINTS" };
  await saveLocalScan("a", first, info);
  await saveLocalScan("b", second, info);
  await updateLocalScanPlacement("a", { scale: 0.001, up: "Y" });
  assert.equal((await getLocalScan("a")).scale, 0.001);
  assert.equal((await getLocalScan("b")).scale, 1);
  assert.equal(await (await getLocalScanSource("a")).text(), "first");
  await deleteLocalScan("a");
  assert.equal(await getLocalScan("a"), undefined);
  assert.equal(await getLocalScanSource("a"), undefined);
  assert.equal((await getLocalScan("b")).name, "second.ply");
  await deleteLocalScan("b");
});

test("an aborted replacement preserves the previously stored scan", async () => {
  await saveLocalScan("c", new File(["old"], "old.ply"), {
    count: 1,
    kind: "POINTS",
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    saveLocalScan(
      "c",
      new File(["new"], "new.ply"),
      { count: 2, kind: "SPLAT" },
      controller.signal
    )
  );
  assert.equal((await getLocalScan("c")).name, "old.ply");
  await deleteLocalScan("c");
});
