import { createSlice } from "@reduxjs/toolkit";

import logoutService from "./services/logoutService";
import setUserProfileInLocalStorage from "./services/setUserProfileInLocalStorage";
import setTokenInLocalStorage from "./services/setTokenInLocalStorage";

const authSlice = createSlice({
  name: "init",
  initialState: {
    userEmail: null,
    userProfile: {},
    token: null,
  },
  reducers: {
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
    setUserProfile: (state, action) => {
      state.userProfile = action.payload;
      setUserProfileInLocalStorage(action.payload);
    },
    setToken: (state, action) => {
      state.token = action.payload;
      setTokenInLocalStorage(action.payload);
    },
    //
    logout: (state) => {
      state.userEmail = null;
      state.userProfile = {};
      state.token = null;
      logoutService();
    },
  },
});

export const { setUserEmail, setUserProfile, setToken, logout } =
  authSlice.actions;
export default authSlice.reducer;
