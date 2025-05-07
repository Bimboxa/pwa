import {createSlice} from "@reduxjs/toolkit";

const initSlice = createSlice({
  name: "init",
  initialState: {
    openLandingPage: true,
    //
    initConnexionToRemoteWasDone: false,
    warningWasShowed: false, // remoteContainer connexion warning.
  },
  reducers: {
    setOpenLandingPage: (state, action) => {
      state.openLandingPage = action.payload;
    },
    setWarningWasShowed: (state, action) => {
      state.warningWasShowed = action.payload;
    },
    setInitConnextionToRemoteWasDone: (state, action) => {
      state.initConnexionToRemoteWasDone = action.payload;
    },
  },
});

export const {
  setOpenLandingPage,
  setWarningWasShowed,
  setInitConnextionToRemoteWasDone,
} = initSlice.actions;
export default initSlice.reducer;
