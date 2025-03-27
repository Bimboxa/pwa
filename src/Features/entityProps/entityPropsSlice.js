import {createSlice} from "@reduxjs/toolkit";

const entityPropsInitialState = {
  //
  multiSelect: false,
  //
  selection: [], // ids of the selected entitiesWithProps (/!\ not the entitiesProps ids)
};

export const entityPropsSlice = createSlice({
  name: "entityProps",
  initialState: entityPropsInitialState,
  reducers: {
    setMultiSelect: (state, action) => {
      state.multiSelect = action.payload;
    },
    setSelection: (state, action) => {
      state.selection = action.payload;
    },
    //
  },
});

export const {setMultiSelect, setSelection} = entityPropsSlice.actions;

export default entityPropsSlice.reducer;
