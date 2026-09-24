import test from "node:test";
import assert from "node:assert/strict";
import { createLlmTrace, advanceLlmTrace } from "./chatTrace.js";
import { updateChatTimeline } from "./chatTimeline.js";

test("trace prefix and session counter survive duplicate and older events", () => {
  assert.match(createLlmTrace().prefix, /^[A-Z]{3}$/);
  let trace = { prefix: "RQL", nextStep: 1 };
  trace = advanceLlmTrace(trace, { traceCode: "RQL-07", sessionStep: 7 });
  assert.equal(trace.nextStep, 8);
  assert.equal(
    advanceLlmTrace(trace, { traceCode: "RQL-02", sessionStep: 2 }).nextStep,
    8
  );
  assert.equal(
    advanceLlmTrace(trace, { traceCode: "ABC-09", sessionStep: 9 }),
    trace
  );
});

test("timeline distinguishes retries with the same local step and preserves codes", () => {
  let state;
  for (const traceCode of ["RQL-07", "RQL-08"]) {
    state = updateChatTimeline(
      state,
      { type: "tokens", usage: { step: 1, traceCode } },
      100
    );
    state = updateChatTimeline(
      state,
      { type: "tokens", usage: { step: 1, traceCode, confirmed: true } },
      200
    );
  }
  assert.equal(state.entries.length, 2);
  assert.match(state.entries[0].title, /RQL-07/);
  assert.equal(state.entries[1].status, "done");
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});
