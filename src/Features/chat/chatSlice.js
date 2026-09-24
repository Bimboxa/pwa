import { v4 as uuidv4 } from "uuid";
import { createSlice } from "@reduxjs/toolkit";

import { loadVectorizationSessionIds } from "../assistantRelay/utils/vectorizationPointer.js";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    // { id?, role, content, type?: "vectorization", run?, toolRunning?,
    //   localStep?, localError? }
    messages: [],
    isThinking: false,
    budgetRevision: 0,
    sending: false,
    // Stable local identity, preserved while another session is selected.
    sessionId: 0,
    //
    managedDataByAgent: { structure: null, data: null }, // STRUCTURE: ZONING, TREE, LIST,
    // PDF dropped in the chat, uploaded to the relay, waiting for "Envoyer".
    // { status: "uploading"|"ready"|"error", fileName, pdfId, pageCount, pageNumber, error }
    pendingPdf: null,
    // The run this tab follows: { runId, messageId, target }.
    vectorization: null,
    // Conversation kept by the provider: id of the last turn, and the key of
    // the plan picture the model has already been shown.
    conversation: {
      previousResponseId: null,
      imageKey: null,
      budgetSessionId: uuidv4(),
      sessionName: null,
    },
    // Levels of reflection offered by the relay ([{ id, label, model }]) and
    // the user's pick (null = the relay default, `high`).
    reasoningLevels: [],
    reasoningLevelId: null,
  },
  reducers: {
    setSending(state, action) {
      state.sending = action.payload;
    },
    refreshBudget(state) {
      state.budgetRevision += 1;
    },
    setIsThinking(state, action) {
      state.isThinking = action.payload;
    },
    sendMessageContent(state, action) {
      state.messages.push({ role: "user", content: action.payload });
      state.isThinking = true;
    },
    receiveMessageContent(state, action) {
      state.messages.push({ role: "assistant", content: action.payload });
      state.isThinking = false;
    },
    addMessage(state, action) {
      state.messages.push(action.payload);
    },
    updateMessageById(state, action) {
      const { id, changes } = action.payload;
      const message = state.messages.find((m) => m.id === id);
      if (message) Object.assign(message, changes);
    },
    appendMessageContent(state, action) {
      const { id, delta } = action.payload;
      const message = state.messages.find((m) => m.id === id);
      if (message) message.content = (message.content ?? "") + delta;
    },
    setPendingPdf(state, action) {
      state.pendingPdf = action.payload
        ? { ...(state.pendingPdf ?? {}), ...action.payload }
        : null;
    },
    setVectorization(state, action) {
      state.vectorization = action.payload ?? null;
    },
    appendMessageAction(state, action) {
      const { id, toolAction } = action.payload;
      const message = state.messages.find((m) => m.id === id);
      if (!message) return;
      const actions = message.actions ?? (message.actions = []);
      const existing = actions.find((a) => a.callId === toolAction.callId);
      if (existing) Object.assign(existing, toolAction);
      else actions.push(toolAction);
    },
    updateMessageAction(state, action) {
      const { id, callId, changes } = action.payload;
      const message = state.messages.find((m) => m.id === id);
      const toolAction = message?.actions?.find((a) => a.callId === callId);
      if (toolAction) Object.assign(toolAction, changes);
    },
    captureSessionContext(state, action) {
      if (state.conversation.navigationContext) return;
      state.conversation.navigationContext = action.payload;
      const name = action.payload.baseMapName;
      state.conversation.sessionName = name
        ? `[${name.slice(0, 90)}] Session ${state.sessionId + 1}`
        : null;
    },
    setConversation(state, action) {
      state.conversation = { ...state.conversation, ...action.payload };
    },
    // Session creation is handled by the outer reducer without clearing history.
    resetConversation: {
      prepare: ({ baseMapName } = {}) => ({
        payload: uuidv4(),
        meta: { baseMapName: baseMapName?.trim() || null },
      }),
      reducer() {},
    },
    setReasoningLevels(state, action) {
      state.reasoningLevels = action.payload ?? [];
    },
    setReasoningLevelId(state, action) {
      state.reasoningLevelId = action.payload ?? null;
    },
    //
    setManagedDataByAgent(state, action) {
      state.managedDataByAgent = action.payload;
    },
  },
});

export const {
  setSending,
  refreshBudget,
  setIsThinking,
  sendMessageContent,
  receiveMessageContent,
  addMessage,
  updateMessageById,
  appendMessageContent,
  setPendingPdf,
  setVectorization,
  appendMessageAction,
  updateMessageAction,
  setConversation,
  captureSessionContext,
  resetConversation,
  setReasoningLevels,
  setReasoningLevelId,
  setManagedDataByAgent,
} = chatSlice.actions;
// Keep the active session projection for consumers outside a session provider.
// Scoped actions always update their originating session, including late events.
export const selectSession = (sessionId) => ({
  type: "chat/selectSession",
  payload: sessionId,
});

export default function reducer(state, action) {
  if (!state?.sessions) {
    const first = state ?? chatSlice.getInitialState();
    const sessions = { [first.sessionId]: first };
    for (const sessionId of loadVectorizationSessionIds()) {
      sessions[sessionId] = {
        ...chatSlice.getInitialState(),
        sessionId,
        conversation: { ...first.conversation, budgetSessionId: uuidv4() },
      };
    }
    state = {
      ...first,
      activeSessionId: first.sessionId,
      sessionIds: Object.keys(sessions).map(Number),
      sessions,
    };
  }
  if (action.type === "chat/selectSession") {
    if (!state.sessions[action.payload]) return state;
    return {
      ...state,
      ...state.sessions[action.payload],
      activeSessionId: action.payload,
    };
  }
  if (action.type === resetConversation.type) {
    const sessionId = Math.max(...state.sessionIds) + 1;
    const session = {
      ...chatSlice.getInitialState(),
      sessionId,
      reasoningLevels: state.reasoningLevels,
      reasoningLevelId: state.reasoningLevelId,
      budgetRevision: state.budgetRevision,
      conversation: {
        previousResponseId: null,
        imageKey: null,
        budgetSessionId: action.payload,
        // Draft title; refreshed with the actual context at the first send.
        sessionName: action.meta?.baseMapName
          ? `[${action.meta.baseMapName.slice(0, 90)}] Session ${sessionId + 1}`
          : null,
      },
    };
    return {
      ...state,
      ...session,
      activeSessionId: sessionId,
      sessionIds: [...state.sessionIds, sessionId],
      sessions: { ...state.sessions, [sessionId]: session },
    };
  }
  if (
    action.type === refreshBudget.type ||
    action.type === setReasoningLevels.type
  ) {
    const sessions = Object.fromEntries(
      Object.entries(state.sessions).map(([id, session]) => [
        id,
        chatSlice.reducer(session, action),
      ])
    );
    return { ...state, ...sessions[state.activeSessionId], sessions };
  }
  const sessionId = action.meta?.chatSessionId ?? state.activeSessionId;
  const previous = state.sessions[sessionId];
  if (!previous) return state;
  const session = chatSlice.reducer(previous, action);
  if (session === previous) return state;
  return {
    ...state,
    ...(sessionId === state.activeSessionId ? session : {}),
    sessions: { ...state.sessions, [sessionId]: session },
  };
}
