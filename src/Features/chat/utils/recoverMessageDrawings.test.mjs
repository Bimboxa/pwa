import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverMessageDrawings } from "./recoverChatDrawing.js";

const drawing = (jobId, extra = {}) => ({
  name: "draw_annotations",
  jobId,
  callId: jobId,
  ...extra,
});

test("an analysis without a drawing never fetches or imports unrelated jobs", async () => {
  const results = await recoverMessageDrawings(
    [
      { name: "request_plan_image", jobId: "unrelated" },
      drawing(null),
      drawing("undone", { undone: true }),
    ],
    {
      fetchJob: async () => assert.fail("Must not fetch"),
      applyLiveJob: async () => assert.fail("Must not import"),
    }
  );
  assert.deepEqual(results, []);
});

test("recovers missing local statuses once and continues after one job fails", async () => {
  const reads = [];
  const imports = [];
  const results = await recoverMessageDrawings(
    [
      drawing("offline"),
      drawing("pending"),
      drawing("pending", { callId: "duplicate" }),
      drawing("imported"),
    ],
    {
      fetchJob: async (id) => {
        reads.push(id);
        if (id === "offline") throw new Error("Offline");
        return {
          jobId: id,
          mode: "live",
          status:
            id === "imported" || imports.includes(id) ? "imported" : "proposed",
          payload: { annotations: [{ id: "wall" }] },
        };
      },
      applyLiveJob: async (job, options) => {
        assert.equal(options.manual, true);
        imports.push(job.jobId);
      },
    }
  );
  assert.deepEqual(reads, ["offline", "pending", "pending", "imported"]);
  assert.deepEqual(imports, ["pending"]);
  assert.match(results[0].failure.message, /Offline/);
  assert.deepEqual(
    results.slice(1).map((r) => r.liveStatus),
    ["applied", "applied", "applied"]
  );
});

for (const phase of ["failed", "interrupted"]) {
  test(`reports a ${phase} drawing without a job instead of silently ignoring it`, async () => {
    const action = drawing(null, { callId: "refused-drawing", phase });
    const results = await recoverMessageDrawings([action], {
      fetchJob: async () => assert.fail("Must not fetch unrelated jobs"),
      applyLiveJob: async () => assert.fail("Must not import unvalidated geometry"),
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].action, action);
    assert.match(results[0].error, /reprenez le traitement/i);
    assert.equal(results[0].liveStatus, undefined);
  });
}
