import { createSlice } from "@reduxjs/toolkit";

const localLlmSlice = createSlice({
  name: "localLlm",
  initialState: {
    messages: [], // { role: "user" | "assistant", content }
    modelStatus: "checking", // checking | unsupported | unavailable | downloadable | downloading | available
    downloadProgress: 0, // 0..1
    isStreaming: false,
  },
  reducers: {
    setModelStatus(state, action) {
      state.modelStatus = action.payload;
    },
    setDownloadProgress(state, action) {
      state.downloadProgress = action.payload;
    },
    addUserMessage(state, action) {
      state.messages.push({ role: "user", content: action.payload });
      state.messages.push({ role: "assistant", content: "" });
      state.isStreaming = true;
    },
    appendToLastAssistantMessage(state, action) {
      const last = state.messages[state.messages.length - 1];
      if (last?.role === "assistant") last.content += action.payload;
    },
    endStreaming(state) {
      state.isStreaming = false;
    },
    resetConversation(state) {
      state.messages = [];
      state.isStreaming = false;
    },
  },
});

export const {
  setModelStatus,
  setDownloadProgress,
  addUserMessage,
  appendToLastAssistantMessage,
  endStreaming,
  resetConversation,
} = localLlmSlice.actions;
export default localLlmSlice.reducer;
