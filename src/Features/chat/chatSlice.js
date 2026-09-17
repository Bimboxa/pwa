import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    // { id?, role, content, type?: "vectorization", run?, toolRunning?,
    //   localStep?, localError? }
    messages: [],
    isThinking: false,
    //
    managedDataByAgent: { structure: null, data: null }, // STRUCTURE: ZONING, TREE, LIST,
    // PDF dropped in the chat, uploaded to the relay, waiting for "Envoyer".
    // { status: "uploading"|"ready"|"error", fileName, pdfId, pageCount, pageNumber, error }
    pendingPdf: null,
    // The run this tab follows: { runId, messageId, target }.
    vectorization: null,
    // Models offered by the relay ([{ id, isDefault }]) and the user's pick
    // (null = the relay default).
    vectorizationModels: [],
    vectorizationModelId: null,
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
    setVectorizationModels(state, action) {
      state.vectorizationModels = action.payload ?? [];
    },
    setVectorizationModelId(state, action) {
      state.vectorizationModelId = action.payload ?? null;
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
  setVectorizationModels,
  setVectorizationModelId,
  setManagedDataByAgent,
} = chatSlice.actions;
export default chatSlice.reducer;
