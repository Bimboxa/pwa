import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";

import {fetchServicesCredentialsService} from "./services";

export const fetchServicesCredentials = createAsyncThunk(
  "servicesCredentials/fetchServicesCredentials",
  fetchServicesCredentialsService
);

const servicesCredentialsInitialState = {
  //
  data: null,
  //
};

export const servicesCredentialsSlice = createSlice({
  name: "servicesCredentials",
  initialState: servicesCredentialsInitialState,
  extraReducers: (builder) => {
    builder.addCase(fetchServicesCredentials.fulfilled, (state, action) => {
      state.data = action.payload;
    });
  },
});

export const {} = servicesCredentialsSlice.actions;

export default servicesCredentialsSlice.reducer;
