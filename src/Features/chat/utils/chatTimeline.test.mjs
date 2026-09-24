import assert from "node:assert/strict";
import { test } from "node:test";
import {
  updateChatTimeline as update,
  formatStepDuration,
} from "./chatTimeline.js";

test("timeline keeps model calls, tool results and contextual summaries after completion", () => {
  let state = update(
    undefined,
    { type: "progress", stage: "preparing", model: "test" },
    0
  );
  state = update(
    state,
    { type: "tokens", usage: { step: 1, confirmed: false } },
    10,
    "Détecte les murs"
  );
  const previous = state;
  assert.equal(
    update(state, { type: "tokens", usage: { step: 1, confirmed: false } }, 20),
    state
  );
  state = update(
    state,
    { type: "tokens", usage: { step: 1, confirmed: true } },
    30
  );
  assert.equal(previous.entries[1].status, "running");
  state = update(
    state,
    {
      type: "tool",
      name: "measure_plan_geometry",
      callId: "measure",
      phase: "started",
    },
    40
  );
  state = update(
    state,
    {
      type: "tool",
      name: "measure_plan_geometry",
      callId: "measure",
      phase: "done",
    },
    65
  );
  state = update(
    state,
    { type: "tokens", usage: { step: 2, confirmed: false } },
    70
  );
  assert.match(state.entries.at(-1).summary, /Mesures géométriques/);
  state = update(state, { type: "done" }, 120);
  assert.deepEqual(
    state.entries.map((e) => e.kind),
    ["preparation", "model", "tool", "model"]
  );
  assert.ok(state.entries.every((e) => e.status === "done"));
  assert.equal(formatStepDuration(state.entries[2], 9999), "25 ms");
  assert.match(state.entries[1].summary, /Détecte les murs/);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test("errors, interruptions and repeated tool starts retain accurate statuses without recording payloads", () => {
  let state = update(
    undefined,
    {
      type: "tool",
      callId: "a",
      name: "render_plan_region",
      phase: "started",
      arguments: "SECRET",
    },
    0
  );
  state = update(
    state,
    { type: "tool", callId: "a", name: "render_plan_region", phase: "started" },
    10
  );
  assert.equal(state.entries.length, 1);
  state = update(state, { type: "trace_end" }, 100);
  assert.equal(state.entries[0].status, "interrupted");
  assert.doesNotMatch(JSON.stringify(state), /SECRET/);
  state = update(
    state,
    { type: "tokens", usage: { step: 1, confirmed: false } },
    101
  );
  state = update(
    state,
    { type: "tokens", usage: { step: 1, confirmed: true } },
    110
  );
  state = update(state, { type: "error" }, 115);
  assert.equal(state.entries.at(-1).status, "failed");
});

test("trace history is bounded and reports discarded entries", () => {
  let state;
  for (let i = 0; i < 210; i++) {
    state = update(
      state,
      {
        type: "tool",
        callId: String(i),
        name: "query_plan_geometry",
        phase: "done",
      },
      i
    );
  }
  assert.equal(state.entries.length, 200);
  assert.equal(state.omitted, 10);
});

test("Python purpose updates the existing step and survives JSON export", async () => {
  const { serializeChatTimeline, updateChatTimeline } = await import("./chatTimeline.js");
  let state = updateChatTimeline(
    undefined,
    { type: "tool", phase: "started", callId: "py1", name: "code_interpreter" },
    100
  );
  state = updateChatTimeline(
    state,
    {
      type: "tool",
      phase: "started",
      callId: "py1",
      name: "code_interpreter",
      summary: "Mesurer les épaisseurs des murs.",
    },
    200
  );
  state = updateChatTimeline(
    state,
    { type: "tool", phase: "done", callId: "py1", name: "code_interpreter" },
    500
  );
  const data = JSON.parse(serializeChatTimeline(state));
  assert.equal(data.steps.length, 1);
  assert.equal(data.steps[0].summary, "Mesurer les épaisseurs des murs.");
  assert.equal(data.steps[0].durationMs, 400);
  assert.equal(data.steps[0].status, "done");
  assert.deepEqual(JSON.parse(serializeChatTimeline(null)).steps, []);
});
