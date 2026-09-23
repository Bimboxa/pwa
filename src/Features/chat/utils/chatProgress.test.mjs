import assert from "node:assert/strict";
import { test } from "node:test";
import { updateChatProgress, formatChatElapsed } from "./chatProgress.js";

test("progress distinguishes a prepared PDF from provider acceptance without resetting elapsed time", () => {
  const started = { startedAt: 1000, stage: "preparing" };
  const ready = updateChatProgress(started, {
    stage: "pdf_ready",
    source: "pdf",
  });
  assert.equal(ready.planStatus, "PDF prêt côté serveur");
  const sending = updateChatProgress(ready, {
    stage: "sending",
    source: "pdf",
    model: "model",
  });
  assert.equal(sending.planStatus, ready.planStatus);
  const analyzing = updateChatProgress(sending, {
    stage: "analyzing",
    source: "pdf",
    model: "model",
  });
  assert.equal(analyzing.planStatus, "PDF disponible pour le LLM");
  assert.equal(analyzing.startedAt, 1000);
  assert.equal(formatChatElapsed(analyzing.startedAt, 62000), "01:01");
});

test("late upload completion cannot replace an acknowledged image analysis", () => {
  const analyzing = updateChatProgress(
    { startedAt: 1000 },
    { stage: "analyzing", source: "image" }
  );
  assert.deepEqual(
    updateChatProgress(analyzing, { stage: "image_ready" }),
    analyzing
  );
  const fallback = updateChatProgress(
    { startedAt: 1000 },
    { stage: "image_fallback" }
  );
  assert.equal(fallback.planStatus, "Source utilisée : image du fond");
});
