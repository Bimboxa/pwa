import { createSlice } from "@reduxjs/toolkit";

const showerInitialState = {
  showBgImage: false,
  showLegend: false,
};

export const showerSlice = createSlice({
  name: "shower",
  initialState: showerInitialState,
  reducers: {
    setShowBgImage: (state, action) => {
      state.showBgImage = action.payload;
    },
  },
});

export const { setShowBgImage } = showerSlice.actions;

export default showerSlice.reducer;
