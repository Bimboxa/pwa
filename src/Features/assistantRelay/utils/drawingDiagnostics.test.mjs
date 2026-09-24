import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDrawingDiagnostics,
  buildDrawingDiagnostic,
} from "./drawingDiagnostics.js";

test("records the claim failure and suppresses repeated observation/skip noise", () => {
  const log = createDrawingDiagnostics();
  log.record("j", "job_observed", { status: "proposed" });
  log.record("j", "claim_failed", { code: "NETWORK", token: "secret" });
  for (let i = 0; i < 80; i++) {
    log.record("j", "job_observed", { status: "proposed" });
    log.record("j", "skipped_already_attempted");
  }
  const history = log.read("j");
  assert.equal(history.attempts.length, 3);
  assert.equal(history.attempts[1].details.code, "NETWORK");
  assert.ok(!JSON.stringify(history).includes("secret"));
  history.attempts.length = 0;
  assert.equal(log.read("j").attempts.length, 3);
});

test("history is bounded by jobs and events", () => {
  const log = createDrawingDiagnostics();
  for (let i = 0; i < 110; i++) {
    log.record(String(i), "claim_started");
    log.connection({ status: String(i), token: "secret" });
  }
  assert.equal(log.read("0").attempts.length, 0);
  for (let i = 0; i < 60; i++) log.record("109", "test", { status: String(i) });
  assert.equal(log.read("109").attempts.length, 40);
  assert.equal(log.read("109").connection.length, 100);
  assert.ok(!JSON.stringify(log.read("109")).includes("secret"));
});

test("exports local and server evidence without credentials, raw errors or geometry", () => {
  const report = buildDrawingDiagnostic({
    jobId: "j",
    capturedAt: "2026-09-24T10:03:00Z",
    state: {
      auth: { jwt: "secret" },
      assistantRelay: {
        token: "secret",
        sessionKey: "secret",
        connectionError: "secret",
        connectionStatus: "connected",
        realtimeTransport: "bridge-sse",
        jobsById: {
          j: { status: "proposed", createdAt: "2026-09-24T10:00:00Z" },
        },
      },
      mapEditor: { selectedBaseMapId: "current" },
    },
    serverJob: {
      jobId: "j",
      status: "rejected",
      error: "expired",
      createdAt: "2026-09-24T10:00:00Z",
      snapshot: { baseMapId: "target", image: "secret" },
      payload: { annotations: [{ text: "secret" }] },
    },
    history: createDrawingDiagnostics().read("j"),
    environment: { online: true, visibility: "visible" },
  });
  assert.equal(report.ageMs, 180000);
  assert.equal(report.serverJob.expired, true);
  assert.equal(report.serverJob.annotationCount, 1);
  assert.equal(report.localJob.status, "proposed");
  assert.equal(report.serverJob.baseMapId, "target");
  assert.equal(report.currentContext.baseMapId, "current");
  assert.ok(!JSON.stringify(report).includes("secret"));
});

test("offline read preserves usable local evidence and handles unknown dates", () => {
  const report = buildDrawingDiagnostic({
    jobId: "j",
    state: {},
    history: createDrawingDiagnostics().read("j"),
    fetchError: { code: "NETWORK", status: 0, message: "secret" },
    environment: { online: false, visibility: "hidden" },
  });
  assert.equal(report.ageMs, null);
  assert.equal(report.serverRead.ok, false);
  assert.equal(report.serverRead.code, "NETWORK");
  assert.equal(report.environment.online, false);
  assert.ok(!JSON.stringify(report).includes("secret"));
});
