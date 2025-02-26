import {createSlice} from "@reduxjs/toolkit";

const gapiInitialState = {
  accessToken: null,
  isSignedIn: false,
  gapiIsLoaded: false,
  bimboxFolderId: null,
  gSheetId: null,
};

export const gapiSlice = createSlice({
  name: "gapi",
  initialState: gapiInitialState,
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    setIsSignedIn: (state, action) => {
      state.isSignedIn = action.payload;
    },
    setGapiIsLoaded: (state, action) => {
      state.gapiIsLoaded = action.payload;
    },
    setBimboxFolderId: (state, action) => {
      state.bimboxFolderId = action.payload;
    },
    setGSheetId: (state, action) => {
      state.gSheetId = action.payload;
    },
  },
});

export const {
  setAccessToken,
  setIsSignedIn,
  setGapiIsLoaded,
  //
  setBimboxFolderId,
  setGSheetId,
} = gapiSlice.actions;

export default gapiSlice.reducer;
