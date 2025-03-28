import {createSlice} from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    isThinking: false,
  },
  reducers: {
    sendMessage(state, action) {
      state.messages.push({role: "user", content: action.payload});
      state.isThinking = true;
    },
    receiveMessage(state, action) {
      state.messages.push({role: "assistant", content: action.payload});
      state.isThinking = false;
    },
  },
});

export const {sendMessage, receiveMessage} = chatSlice.actions;
export default chatSlice.reducer;
