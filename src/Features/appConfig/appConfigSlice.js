import {createSlice} from "@reduxjs/toolkit";

const appConfigSlice = createSlice({
  name: "appConfig",
  initialState: {
    value: null,
  },
  reducers: {
    setAppConfig: (state, action) => {
      state.value = action.payload;
    },
  },
});

export const {setAppConfig} = appConfigSlice.actions;
export default appConfigSlice.reducer;
