import {createSlice} from "@reduxjs/toolkit";

const webrtcInitialState = {
  //
  qrCodeDataURL: null,
  //
};

export const webrtcSlice = createSlice({
  name: "webrtc",
  initialState: webrtcInitialState,
  reducers: {
    setQrCodeDataURL: (state, action) => {
      state.qrCodeDataURL = action.payload;
    },
    //
    initiateConnection: (state) => {},
    receiveSignal: (state, action) => {},
  },
});

export const {
  setQrCodeDataURL,
  //
  initiateConnection,
  receiveSignal,
} = webrtcSlice.actions;

export default webrtcSlice.reducer;
