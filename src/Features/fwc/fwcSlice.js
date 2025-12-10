import { createSlice } from "@reduxjs/toolkit";

const fwcSlice = createSlice({
  name: "fwc",
  initialState: {
    showedFWC: ["FLOOR", "WALL", "CEILING"],
  },
  reducers: {
    setShowedFWC: (state, action) => {
      state.showedFWC = action.payload;
    },
  },
});

export const {
  setShowedFWC,
} = fwcSlice.actions;
export default fwcSlice.reducer;
