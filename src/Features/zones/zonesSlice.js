import {createSlice} from "@reduxjs/toolkit";

const zonesInitialState = {
  //
  selectedZoneId: null,
};

export const zonesSlice = createSlice({
  name: "zones",
  initialState: zonesInitialState,
  reducers: {
    setSelectedZoneId: (state, action) => {
      state.selectedZoneId = action.payload;
    },
  },
});

export const {
  setSelectedZoneId,
  //
} = zonesSlice.actions;

export default zonesSlice.reducer;
