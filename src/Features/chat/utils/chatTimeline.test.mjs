import assert from "node:assert/strict";
import { test } from "node:test";
import {
  updateChatTimeline as update,
  formatStepDuration,
  formatTokenUsage,
  formatCost,
  formatSessionUsage,
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
  const { serializeChatTimeline, updateChatTimeline } =
    await import("./chatTimeline.js");
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

test("stable server numbers and failure details survive updates and JSON export", async () => {
  const { serializeChatTimeline } = await import("./chatTimeline.js");
  let state = update(undefined, { type: "progress", stage: "preparing" }, 1);
  state = update(
    state,
    { type: "tokens", stepNumber: 2, usage: { step: 1, traceCode: "ABC-01" } },
    2
  );
  for (const phase of ["started", "started", "failed"])
    state = update(
      state,
      {
        type: "tool",
        callId: "ci-1",
        name: "code_interpreter",
        phase,
        stepNumber: 3,
        ...(phase === "failed" ? { detail: "Tool call limit reached" } : {}),
      },
      3
    );
  const exported = JSON.parse(serializeChatTimeline(state));
  assert.deepEqual(
    exported.steps.map((e) => e.stepNumber),
    [1, 2, 3]
  );
  assert.equal(exported.steps[2].detail, "Tool call limit reached");
  assert.equal(state.nextStepNumber, 4);
});

test("legacy exports number steps including omitted entries", async () => {
  const { serializeChatTimeline } = await import("./chatTimeline.js");
  const data = JSON.parse(
    serializeChatTimeline({ omitted: 8, entries: [{ id: "old" }] })
  );
  assert.equal(data.steps[0].stepNumber, 9);
});

test("interpreter code remains exact across lifecycle updates and JSON export", async () => {
  const { serializeChatTimeline } = await import("./chatTimeline.js");
  const code =
    "# KRT_STEP: Inspect geometry.\n" + "    print('é <tag>')\n".repeat(500);
  const base = {
    type: "tool",
    callId: "python-code",
    name: "code_interpreter",
  };
  let state = update(undefined, { ...base, phase: "started", code }, 0);
  state = update(state, { ...base, phase: "started" }, 10);
  state = update(
    state,
    { ...base, phase: "failed", detail: "Python error" },
    20
  );
  const steps = JSON.parse(serializeChatTimeline(state)).steps;
  assert.equal(steps.length, 1);
  assert.equal(steps[0].code, code);
  assert.equal(steps[0].status, "failed");
  assert.equal(steps[0].detail, "Python error");
  const old = update(undefined, { ...base, phase: "done" });
  assert.equal(JSON.parse(serializeChatTimeline(old)).steps[0].code, null);
  const other = update(undefined, {
    ...base,
    name: "query_annotations",
    phase: "done",
    code,
  });
  assert.equal(
    JSON.parse(serializeChatTimeline(other)).steps[0].code,
    undefined
  );
});

test("unconfirmed Python execution remains interrupted and raster tools have readable labels", () => {
  let state = update(
    undefined,
    {
      type: "tool",
      phase: "started",
      callId: "python",
      name: "code_interpreter",
    },
    0
  );
  state = update(
    state,
    {
      type: "tool",
      phase: "interrupted",
      callId: "python",
      name: "code_interpreter",
      detail: "Execution not confirmed",
    },
    100
  );
  state = update(state, { type: "done" }, 200);
  assert.equal(state.entries[0].status, "interrupted");
  assert.equal(state.entries[0].detail, "Execution not confirmed");
  state = update(
    state,
    {
      type: "tool",
      phase: "done",
      callId: "raster",
      name: "analyze_raster_sections",
      summary: "3 candidats",
    },
    250
  );
  assert.equal(state.entries[1].title, "Mesure des sections raster");
  assert.equal(state.entries[1].summary, "3 candidats");
});

test("timeline keeps confirmed token counters per model call and the turn total", () => {
  let state = update(
    undefined,
    { type: "tokens", usage: { step: 1, confirmed: false, outputTokens: 3 } },
    0
  );
  assert.equal(state.entries[0].usage, undefined);
  state = update(
    state,
    {
      type: "tokens",
      usage: {
        step: 1,
        confirmed: true,
        inputTokens: 12300,
        cachedTokens: 9800,
        outputTokens: 1200,
        reasoningTokens: 450,
      },
    },
    10
  );
  assert.deepEqual(state.entries[0].usage, {
    inputTokens: 12300,
    cachedTokens: 9800,
    cacheWriteTokens: null,
    outputTokens: 1200,
    reasoningTokens: 450,
    model: null,
    costMicros: null,
  });
  assert.equal(
    formatTokenUsage(state.entries[0].usage),
    "Entrée 12\u202f300 tokens (9\u202f800 en cache) · Sortie 1\u202f200 (450 raisonnement)"
  );
  state = update(
    state,
    {
      type: "done",
      usage: { inputTokens: 12300, cachedTokens: 9800, outputTokens: 1200 },
    },
    20
  );
  assert.equal(state.usage.cachedTokens, 9800);
  assert.equal(state.cost, null);
  assert.equal(formatTokenUsage(undefined), "");
  assert.equal(formatTokenUsage({ inputTokens: null }), "");
});

test("timeline keeps the priced model of each call and the cost of the turn", () => {
  let state = update(
    undefined,
    { type: "progress", stage: "sending", model: "gpt-5.4-mini" },
    0
  );
  state = update(
    state,
    { type: "tokens", usage: { step: 1, confirmed: false, outputTokens: 0 } },
    1
  );
  // The relay switched to the analysis model during the call.
  state = update(
    state,
    {
      type: "tokens",
      usage: {
        step: 1,
        confirmed: true,
        model: "gpt-6-astra",
        costMicros: 12345,
        inputTokens: 1000,
        cachedTokens: 0,
        cacheWriteTokens: 1000,
        outputTokens: 100,
        reasoningTokens: 0,
      },
    },
    5
  );
  assert.equal(state.entries[0].model, "gpt-6-astra");
  assert.equal(state.entries[0].usage.costMicros, 12345);
  assert.equal(
    formatTokenUsage(state.entries[0].usage),
    "Entrée 1\u202f000 tokens (0 en cache, 1\u202f000 écrits) · Sortie 100 · 0,012\u00a0€"
  );
  state = update(
    state,
    {
      type: "done",
      steps: 1,
      usage: { inputTokens: 1000, cachedTokens: 0, outputTokens: 100 },
      cost: { micros: 12345, currency: "EUR", complete: true },
    },
    9
  );
  assert.deepEqual(state.cost, {
    micros: 12345,
    currency: "EUR",
    complete: true,
  });
  assert.equal(state.steps, 1);
  assert.equal(formatCost(state.cost), "0,012\u00a0€");
  assert.equal(
    formatCost({ micros: 420000, complete: false }),
    "≥ 0,42\u00a0€ (tarif inconnu pour une partie)"
  );
  assert.equal(formatCost(null), "Coût indisponible");
  assert.equal(
    formatSessionUsage({
      turns: 2,
      calls: 5,
      inputTokens: 50000,
      cachedTokens: 40000,
      outputTokens: 800,
      costMicros: 1500000,
      costComplete: true,
    }),
    "2 tour(s) · 5 appel(s) au modèle · Entrée 50\u202f000 tokens (40\u202f000 en cache) · Sortie 800 · Coût cumulé 1,50\u00a0€"
  );
  assert.equal(formatSessionUsage({ turns: 0 }), "");
});

test("drawing arguments captured by the relay join their step and the JSON export", async () => {
  const { serializeChatTimeline } = await import("./chatTimeline.js");
  const argumentsJson = JSON.stringify({
    shapes: [{ kind: "polyline", template: { label: "À vérifier" } }],
  });
  let state = update(
    undefined,
    {
      type: "detection_debug",
      artifact: {
        id: "d1",
        callId: "d1",
        stage: "raw_detection",
        data: { tool: "draw_annotations", argumentsJson, step: 3 },
      },
    },
    100
  );
  assert.equal(state.entries.length, 1);
  state = update(
    state,
    { type: "tool", phase: "started", callId: "d1", name: "draw_annotations" },
    120
  );
  state = update(
    state,
    {
      type: "tool",
      phase: "done",
      callId: "d1",
      name: "draw_annotations",
      jobId: "job",
      liveStatus: "applied",
    },
    500
  );
  // Other diagnostics and other tools' arguments are not recorded.
  state = update(
    state,
    {
      type: "detection_debug",
      artifact: {
        id: "c",
        callId: "d1",
        stage: "converted_detection",
        data: {},
      },
    },
    510
  );
  state = update(
    state,
    {
      type: "detection_debug",
      artifact: {
        id: "b",
        callId: "b",
        stage: "raw_detection",
        data: { tool: "create_annotation_templates", argumentsJson: "{bad" },
      },
    },
    520
  );
  assert.equal(state.entries.length, 2);
  const steps = JSON.parse(serializeChatTimeline(state)).steps;
  assert.equal(steps[0].name, "draw_annotations");
  assert.equal(steps[0].status, "done");
  assert.equal(steps[0].durationMs, 400);
  assert.deepEqual(steps[0].arguments, JSON.parse(argumentsJson));
  assert.equal(steps[1].arguments, "{bad");
  assert.equal(steps[1].status, "running");
});
