import { createSlice } from "@reduxjs/toolkit";

import logoutService from "./services/logoutService";
import setUserProfileInLocalStorage from "./services/setUserProfileInLocalStorage";
import setTokenInLocalStorage from "./services/setTokenInLocalStorage";

const authSlice = createSlice({
  name: "init",
  clerkIsEnabled: false,
  initialState: {
    userEmail: null,
    userProfile: {},
    token: null,
    jwt: null,
  },
  reducers: {
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
    setUserProfile: (state, action) => {
      state.userProfile = action.payload;
      setUserProfileInLocalStorage(action.payload);
    },
    updateUserProfile: (state, action) => {
      const updates = action.payload;
      const newProfile = { ...state.userProfile ?? {}, ...updates };
      state.userProfile = newProfile;
      setUserProfileInLocalStorage(newProfile);
    },
    setToken: (state, action) => {
      state.token = action.payload;
      setTokenInLocalStorage(action.payload);
    },
    setJwt: (state, action) => {
      state.jwt = action.payload;
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

export const { setUserEmail, setUserProfile, updateUserProfile, setToken, setJwt, logout } =
  authSlice.actions;
export default authSlice.reducer;
