import {createSlice} from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    isThinking: false,
  },
  reducers: {
    setIsThinking(state, action) {
      state.isThinking = action.payload;
    },
    sendMessageContent(state, action) {
      state.messages.push({role: "user", content: action.payload});
      state.isThinking = true;
    },
    receiveMessageContent(state, action) {
      state.messages.push({role: "assistant", content: action.payload});
      state.isThinking = false;
    },
  },
});

export const {setIsThinking, sendMessageContent, receiveMessageContent} =
  chatSlice.actions;
export default chatSlice.reducer;
