import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const blueprintsInitialState = {
  tempName: "",
};

export const blueprintsSlice = createSlice({
  name: "blueprints",
  initialState: blueprintsInitialState,
  reducers: {
    setTempName: (state, action) => {
      state.tempName = action.payload;
    },
  },
});

export const { setTempName } = blueprintsSlice.actions;

export default blueprintsSlice.reducer;
