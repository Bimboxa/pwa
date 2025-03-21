import {createSlice, createAsyncThunk} from "@reduxjs/toolkit";

import {
  createOrUpdateServiceCredentialService,
  fetchServiceCredentialService,
  deleteServiceCredentialService,
} from "./services";

export const createOrUpdateServiceCredential = createAsyncThunk(
  "servicesCredentials/createOrUpdateServiceCredential",
  createOrUpdateServiceCredentialService
);

export const fetchServiceCredential = createAsyncThunk(
  "servicesCredentials/fetchServiceCredential",
  fetchServiceCredentialService
);

export const deleteServiceCredential = createAsyncThunk(
  "servicesCredentials/deleteServiceCredential",
  deleteServiceCredentialService
);

const servicesCredentialsInitialState = {
  //
  servicesCredentialsMap: {},
  //
};

export const servicesCredentialsSlice = createSlice({
  name: "servicesCredentials",
  initialState: servicesCredentialsInitialState,
  extraReducers: (builder) => {
    builder.addCase(fetchServiceCredential.fulfilled, (state, action) => {
      const serviceCredential = action.payload;
      if (!serviceCredential) return;
      state.servicesCredentialsMap[serviceCredential.key] = serviceCredential;
    });
    builder.addCase(
      createOrUpdateServiceCredential.fulfilled,
      (state, action) => {
        const serviceCredential = action.payload;
        if (!serviceCredential) return;
        state.servicesCredentialsMap[serviceCredential.key] = serviceCredential;
      }
    );
    builder.addCase(deleteServiceCredential.fulfilled, (state, action) => {
      const key = action.payload;
      delete state.servicesCredentialsMap[key];
    });
  },
});

export const {} = servicesCredentialsSlice.actions;

export default servicesCredentialsSlice.reducer;
