import { v4 as uuidv4 } from "uuid";
import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    // { id?, role, content, type?: "vectorization", run?, toolRunning?,
    //   localStep?, localError? }
    messages: [],
    isThinking: false,
    // Bumped by "Nouvelle session": a turn still streaming from the previous
    // session must not write into the new one.
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
    // "Ne pas envoyer l'image": the model is not even offered the plan
    // picture. Ticked by default — the user opts in per message.
    blockPlanImage: true,
    // Levels of reflection offered by the relay ([{ id, label, model }]) and
    // the user's pick (null = the relay default, `high`).
    reasoningLevels: [],
    reasoningLevelId: null,
  },
  reducers: {
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
    setBlockPlanImage(state, action) {
      state.blockPlanImage = Boolean(action.payload);
    },
    setConversation(state, action) {
      state.conversation = { ...state.conversation, ...action.payload };
    },
    // "Nouvelle session": back to an empty chat, the provider-side
    // conversation is forgotten too (the next turn starts a new one).
    resetConversation: {
      prepare: () => ({ payload: uuidv4() }),
      reducer(state, action) {
        state.sessionId += 1;
        state.messages = [];
        state.isThinking = false;
        state.pendingPdf = null;
        state.managedDataByAgent = { structure: null, data: null };
        state.conversation = {
          previousResponseId: null,
          imageKey: null,
          budgetSessionId: action.payload,
          sessionName: null,
        };
      },
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
  setBlockPlanImage,
  setConversation,
  resetConversation,
  setReasoningLevels,
  setReasoningLevelId,
  setManagedDataByAgent,
} = chatSlice.actions;
export default chatSlice.reducer;
