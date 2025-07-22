import { createSlice } from "@reduxjs/toolkit";

import logoutService from "./services/logoutService";
import setUserInfoInLocalStorage from "./services/setUserInfoInLocalStorage";
import setTokenInLocalStorage from "./services/setTokenInLocalStorage";

const authSlice = createSlice({
  name: "init",
  initialState: {
    userEmail: null,
    userInfo: {},
    token: null,
  },
  reducers: {
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
    setUserInfo: (state, action) => {
      state.userInfo = action.payload;
      setUserInfoInLocalStorage(action.payload);
    },
    setToken: (state, action) => {
      state.token = action.payload;
      setTokenInLocalStorage(action.payload);
    },
    //
    logout: (state) => {
      state.userEmail = null;
      state.userInfo = {};
      state.token = null;
      logoutService();
    },
  },
});

export const { setUserEmail, setUserInfo, setToken, logout } =
  authSlice.actions;
export default authSlice.reducer;
