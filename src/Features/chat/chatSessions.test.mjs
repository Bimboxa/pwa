import test from "node:test";
import assert from "node:assert/strict";
import { configureStore } from "@reduxjs/toolkit";
import reducer, {
  addMessage,
  captureSessionContext,
  appendMessageContent,
  resetConversation,
  selectSession,
  setSending,
  setConversation,
  addAttachment,
  markAttachmentsSent,
  updateAttachment,
  setVectorization,
  setReasoningLevels,
  addTurnUsage,
  EMPTY_SESSION_USAGE,
} from "./chatSlice.js";
import createChatSessionStore from "./utils/createChatSessionStore.js";
import {
  loadVectorizationPointer,
  saveVectorizationPointer,
} from "../assistantRelay/utils/vectorizationPointer.js";

const makeStore = () => configureStore({ reducer: { chat: reducer } });
test("parallel responses and stop state stay in their originating sessions", async () => {
  const store = makeStore();
  const first = createChatSessionStore(store, 0);
  first.dispatch(addMessage({ id: "a", role: "assistant", content: "" }));
  first.dispatch(setSending(true));
  store.dispatch(resetConversation());
  const second = createChatSessionStore(store, 1);
  second.dispatch(addMessage({ id: "b", role: "assistant", content: "" }));
  second.dispatch(setSending(true));
  await Promise.all([
    Promise.resolve().then(() =>
      first.dispatch(appendMessageContent({ id: "a", delta: "first" }))
    ),
    Promise.resolve().then(() =>
      second.dispatch(appendMessageContent({ id: "b", delta: "second" }))
    ),
  ]);
  first.dispatch(setSending(false));
  first.dispatch(
    setConversation({ previousResponseId: "response-a", sessionName: "First" })
  );
  assert.equal(store.getState().chat.messages[0].content, "second");
  assert.equal(second.getState().chat.sending, true);
  assert.equal(first.getState().chat.messages[0].content, "first");
  assert.equal(second.getState().chat.conversation.previousResponseId, null);
  assert.notEqual(
    first.getState().chat.conversation.budgetSessionId,
    second.getState().chat.conversation.budgetSessionId
  );
  store.dispatch(selectSession(0));
  assert.equal(store.getState().chat.messages[0].content, "first");
  assert.equal(second.getState().chat.sessionId, 1);
  store.dispatch(resetConversation());
  assert.deepEqual(store.getState().chat.sessionIds, [0, 1, 2]);
});
test("late uploads and vectorization changes do not leak into another session", () => {
  const store = makeStore();
  const first = createChatSessionStore(store, 0);
  first.dispatch(
    addAttachment({ id: "res-a", name: "carnet.pdf", status: "uploading" })
  );
  store.dispatch(resetConversation());
  // The upload ends after the user opened another session.
  first.dispatch(
    updateAttachment({
      id: "res-a",
      changes: { status: "ready", pdfId: "pdf-a" },
    })
  );
  first.dispatch(markAttachmentsSent(["pdf-a"]));
  first.dispatch(markAttachmentsSent(["pdf-a"]));
  first.dispatch(setVectorization({ runId: "run-a" }));
  assert.deepEqual(store.getState().chat.attachments, []);
  assert.deepEqual(store.getState().chat.conversation.attachmentsSent, []);
  assert.equal(store.getState().chat.vectorization, null);
  store.dispatch(selectSession(0));
  assert.equal(store.getState().chat.attachments[0].pdfId, "pdf-a");
  assert.equal(store.getState().chat.attachments.length, 1);
  assert.deepEqual(store.getState().chat.conversation.attachmentsSent, [
    "pdf-a",
  ]);
  assert.equal(store.getState().chat.vectorization.runId, "run-a");
  store.dispatch(setReasoningLevels([{ id: "high" }]));
  assert.deepEqual(first.getState().chat.reasoningLevels, [{ id: "high" }]);
});
test("session stores expose stable snapshots and forward application actions", () => {
  const store = makeStore();
  const scoped = createChatSessionStore(store, 0);
  assert.equal(scoped.getState(), scoped.getState());
  scoped.dispatch((dispatch, getState) => {
    assert.equal(getState().chat.sessionId, 0);
    dispatch(addMessage({ content: "from thunk" }));
  });
  assert.equal(store.getState().chat.messages.length, 1);
});
test("PDF pointers are restored and cleared independently", () => {
  globalThis.sessionStorage = {
    getItem(key) {
      return this[key] ?? null;
    },
    setItem(key, value) {
      this[key] = value;
    },
    removeItem(key) {
      delete this[key];
    },
  };
  try {
    saveVectorizationPointer({ runId: "run-a" }, 0);
    saveVectorizationPointer({ runId: "run-b" }, 3);
    const store = makeStore();
    assert.deepEqual(store.getState().chat.sessionIds, [0, 3]);
    saveVectorizationPointer(null, 0);
    assert.equal(loadVectorizationPointer(0), null);
    assert.equal(loadVectorizationPointer(3).runId, "run-b");
  } finally {
    delete globalThis.sessionStorage;
  }
});

test("first send refreshes the draft context once and isolates session origins", () => {
  const store = makeStore();
  store.dispatch(resetConversation({ baseMapName: "Draft map" }));
  const first = createChatSessionStore(store, 1);
  const context = {
    projectId: "project-a",
    projectName: "Project A",
    scopeId: "scope-a",
    scopeName: "Scope A",
    baseMapId: "map-a",
    baseMapName: "Map A",
  };
  first.dispatch(captureSessionContext(context));
  assert.deepEqual(
    first.getState().chat.conversation.navigationContext,
    context
  );
  assert.equal(
    first.getState().chat.conversation.sessionName,
    "[Map A] Session 2"
  );
  first.dispatch(setConversation({ sessionName: "Server title" }));
  store.dispatch(resetConversation());
  const second = createChatSessionStore(store, 2);
  assert.equal(
    second.getState().chat.conversation.navigationContext,
    undefined
  );
  second.dispatch(captureSessionContext({ ...context, baseMapId: "map-b" }));
  first.dispatch(captureSessionContext({ ...context, baseMapId: "map-c" }));
  assert.equal(
    first.getState().chat.conversation.navigationContext.baseMapId,
    "map-a"
  );
  assert.equal(first.getState().chat.conversation.sessionName, "Server title");
  assert.equal(
    second.getState().chat.conversation.navigationContext.baseMapId,
    "map-b"
  );
  store.dispatch(selectSession(1));
  assert.deepEqual(
    store.getState().chat.conversation.navigationContext,
    context
  );
});
test("first send without a map clears an obsolete draft map title", () => {
  const store = makeStore();
  store.dispatch(resetConversation({ baseMapName: "Old map" }));
  store.dispatch(
    captureSessionContext({
      projectId: null,
      scopeId: null,
      baseMapId: null,
      baseMapName: null,
    })
  );
  assert.equal(store.getState().chat.conversation.sessionName, null);
});

test("turn usage accumulates per session and a new session starts from zero", () => {
  const store = makeStore();
  const first = createChatSessionStore(store, 0);
  assert.deepEqual(store.getState().chat.conversation.usage, EMPTY_SESSION_USAGE);
  first.dispatch(
    addTurnUsage({
      steps: 3,
      usage: {
        inputTokens: 1000,
        cachedTokens: 400,
        cacheWriteTokens: 100,
        outputTokens: 50,
        reasoningTokens: 10,
      },
      cost: { micros: 20000, currency: "EUR", complete: true },
    })
  );
  first.dispatch(
    addTurnUsage({
      steps: 2,
      usage: { inputTokens: 500, cachedTokens: 450, outputTokens: 20 },
      cost: { micros: 5000, currency: "EUR", complete: false },
    })
  );
  assert.deepEqual(store.getState().chat.conversation.usage, {
    turns: 2,
    calls: 5,
    inputTokens: 1500,
    cachedTokens: 850,
    cacheWriteTokens: 100,
    outputTokens: 70,
    reasoningTokens: 10,
    costMicros: 25000,
    costComplete: false,
  });
  store.dispatch(resetConversation());
  assert.deepEqual(store.getState().chat.conversation.usage, EMPTY_SESSION_USAGE);
  // The previous session keeps its totals, and late events still reach it.
  first.dispatch(
    addTurnUsage({ steps: 1, usage: { inputTokens: 1 }, cost: null })
  );
  assert.equal(store.getState().chat.sessions[0].conversation.usage.turns, 3);
  assert.equal(store.getState().chat.sessions[0].conversation.usage.inputTokens, 1501);
  assert.equal(store.getState().chat.conversation.usage.turns, 0);
});
