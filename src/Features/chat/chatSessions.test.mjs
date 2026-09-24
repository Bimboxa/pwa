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
  setPendingPdf,
  setVectorization,
  setReasoningLevels,
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
  store.dispatch(resetConversation());
  first.dispatch(setPendingPdf({ status: "ready", pdfId: "pdf-a" }));
  first.dispatch(setVectorization({ runId: "run-a" }));
  assert.equal(store.getState().chat.pendingPdf, null);
  assert.equal(store.getState().chat.vectorization, null);
  store.dispatch(selectSession(0));
  assert.equal(store.getState().chat.pendingPdf.pdfId, "pdf-a");
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
