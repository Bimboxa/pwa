import {createSlice} from "@reduxjs/toolkit";

const initSlice = createSlice({
  name: "init",
  initialState: {
    openLandingPage: true,
  },
  reducers: {
    setOpenLandingPage: (state, action) => {
      state.openLandingPage = action.payload;
    },
  },
});

export const {setOpenLandingPage} = initSlice.actions;
export default initSlice.reducer;
