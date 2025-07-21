import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "init",
  initialState: {
    userEmail: null,
    userInfo: {},
  },
  reducers: {
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
    setUserInfo: (state, action) => {
      state.userInfo = action.payload;
    },
  },
});

export const { setUserEmail, setUserInfo } = authSlice.actions;
export default authSlice.reducer;
