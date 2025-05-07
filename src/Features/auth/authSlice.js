import {createSlice} from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "init",
  initialState: {
    userEmail: null,
  },
  reducers: {
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
  },
});

export const {setUserEmail} = authSlice.actions;
export default authSlice.reducer;
