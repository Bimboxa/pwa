import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverChatDrawing, drawingLiveStatus } from "./recoverChatDrawing.js";

test("recovers the original drawing through the live importer, then verifies acknowledgement", async () => {
  const pending = {
    jobId: "drawing",
    mode: "live",
    status: "proposed",
    payload: { annotations: [{ id: "wall" }] },
  };
  let applied = false;
  const result = await recoverChatDrawing("drawing", {
    fetchJob: async (id) => {
      assert.equal(id, "drawing");
      return applied ? { ...pending, status: "imported" } : pending;
    },
    applyLiveJob: async (job, options) => {
      assert.equal(job, pending);
      assert.equal(options.manual, true);
      applied = true;
    },
  });
  assert.equal(result.liveStatus, "applied");
  assert.equal(result.error, null);
});

for (const status of [
  "imported",
  "applying",
  "failed",
  "rejected",
  "expired",
]) {
  test(`does not replay a ${status} drawing`, async () => {
    const result = await recoverChatDrawing("drawing", {
      fetchJob: async () => ({ mode: "live", status }),
      applyLiveJob: async () => assert.fail("Must not import again"),
    });
    assert.equal(result.liveStatus, drawingLiveStatus(status));
    assert.equal(Boolean(result.error), status !== "imported");
  });
}

test("reports an unclaimed drawing rather than claiming success", async () => {
  const result = await recoverChatDrawing("drawing", {
    fetchJob: async () => ({
      mode: "live",
      status: "proposed",
      payload: { annotations: [{}] },
    }),
    applyLiveJob: async () => {},
  });
  assert.equal(result.liveStatus, "pending");
  assert.ok(result.error);
});

test("rejects missing geometry and non-drawing commands", async () => {
  for (const job of [
    { mode: "live_undo", status: "proposed" },
    { mode: "live", status: "proposed", payload: { annotationBatch: {} } },
    { mode: "live", status: "proposed", payload: { annotations: [] } },
  ]) {
    await assert.rejects(
      recoverChatDrawing("drawing", {
        fetchJob: async () => job,
        applyLiveJob: async () => assert.fail("Must not import"),
      })
    );
  }
});

test("a read failure does not dispatch a mutation", async () => {
  await assert.rejects(
    recoverChatDrawing("drawing", {
      fetchJob: async () => {
        throw new Error("Offline");
      },
      applyLiveJob: async () => assert.fail("Must not import"),
    }),
    /Offline/
  );
});

test("explicitly recovers an expired drawing using the original job", async () => {
  let applied = false;
  const result = await recoverChatDrawing("expired-drawing", {
    fetchJob: async () => ({
      jobId: "expired-drawing",
      mode: "live",
      status: applied ? "imported" : "rejected",
      error: "expired",
      payload: { annotations: [{ id: "wall" }] },
    }),
    applyLiveJob: async (job, options) => {
      assert.equal(job.jobId, "expired-drawing");
      assert.equal(options.manual, true);
      applied = true;
    },
  });
  assert.equal(result.liveStatus, "applied");
  assert.equal(result.error, null);
});
