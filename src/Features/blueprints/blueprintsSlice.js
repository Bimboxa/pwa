import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const blueprintsInitialState = {
  tempName: "",
  blueprintIdInMapEditor: null,
};

export const blueprintsSlice = createSlice({
  name: "blueprints",
  initialState: blueprintsInitialState,
  reducers: {
    setTempName: (state, action) => {
      state.tempName = action.payload;
    },
    setBlueprintIdInMapEditor: (state, action) => {
      state.blueprintIdInMapEditor = action.payload;
    },
  },
});

export const { setTempName, setBlueprintIdInMapEditor } =
  blueprintsSlice.actions;

export default blueprintsSlice.reducer;
