import { createSlice } from "@reduxjs/toolkit";
import setInitProjectId from "Features/init/services/setInitProjectId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const onboardingInitialState = {
  step: "CREATE_PROJECT",
  //
};

export const onboardingSlice = createSlice({
  name: "onboarding",
  initialState: onboardingInitialState,
  reducers: {
    setStep: (state, action) => {
      state.step = action.payload;
    },
  },
});

export const {
  setStep,
  //
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
