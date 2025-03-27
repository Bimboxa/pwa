import {createSlice} from "@reduxjs/toolkit";

const entityPropsInitialState = {
  //
  multiSelect: false,
  //
  selection: [], // ids of the selected entitiesWithProps (/!\ not the entitiesProps ids)
  //
  tempPropsObject: null, // {props,delete,changedKeys,selectionCount} used for multi-selection before saving
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
    setTempPropsObject: (state, action) => {
      state.tempPropsObject = action.payload;
    },
  },
});

export const {setMultiSelect, setSelection, setTempPropsObject} =
  entityPropsSlice.actions;

export default entityPropsSlice.reducer;
