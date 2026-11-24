import { createSlice } from "@reduxjs/toolkit";

// UI state of the 3D reconstruction feature (base map rebuilt from photos or
// a video, db.reconstructionFrames):
// - showPlayer: bottom bar toggle — the floating video / photos player
//   (PopperReconstructionPlayer) is opened (per-device preference);
// - coupled: the player drives the camera of the 3D editor. Switched off as
//   soon as the user navigates in the 3D view by hand, back on from the
//   button of the player;
// - pullBackM: while coupled, how far (metres, frame of the model) the 3D
//   camera stands behind the camera of the video, along its line of sight —
//   a wider view of the same scene (per-device preference);
// - videoVersion: bumped when the source video is (re)loaded on the device,
//   so that the player reads the file again.
// The playback time lives in the player itself (it changes at every frame).

const STORAGE_KEY = "reconstruction3dSettings";

export const RECONSTRUCTION_PULL_BACK_MAX_M = 5;

function clampPullBack(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(0, number), RECONSTRUCTION_PULL_BACK_MAX_M);
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      showPlayer: Boolean(parsed?.showPlayer),
      pullBackM: clampPullBack(parsed?.pullBackM),
    };
  } catch {
    return { showPlayer: false, pullBackM: 0 };
  }
}

function writeSettings({ showPlayer, pullBackM }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ showPlayer, pullBackM })
    );
  } catch {
    // storage unavailable: the preference stays in memory
  }
}

const reconstruction3dSlice = createSlice({
  name: "reconstruction3d",
  initialState: {
    ...readSettings(),
    coupled: true,
    videoVersion: 0,
  },
  reducers: {
    setShowReconstructionPlayer: (state, action) => {
      state.showPlayer = Boolean(action.payload);
      writeSettings(state);
      // a player opened again starts coupled
      if (state.showPlayer) state.coupled = true;
    },
    setReconstructionCoupled: (state, action) => {
      state.coupled = Boolean(action.payload);
    },
    setReconstructionPullBackM: (state, action) => {
      state.pullBackM = clampPullBack(action.payload);
      writeSettings(state);
    },
    bumpReconstructionVideoVersion: (state) => {
      state.videoVersion += 1;
    },
  },
});

export const {
  setShowReconstructionPlayer,
  setReconstructionCoupled,
  setReconstructionPullBackM,
  bumpReconstructionVideoVersion,
} = reconstruction3dSlice.actions;

export default reconstruction3dSlice.reducer;
