import { createSlice } from "@reduxjs/toolkit";
import theme from "Styles/theme";

//import demoMarker from "./data/demoMarker";

const baseMapEditorInitialState = {
  selectedTab: "INFO", // INFO, TOOLS, ANNOTATIONS
  //
  grayLevelThreshold: 255, // 255 = on laisse tout, 0 = on coupe tout
  // viewer
  displayedBaseMapListingId: null,
  collapsedListingIds: [],
  creatingInListingId: null,
  expandedBaseMapVersionIds: [], // baseMap IDs whose version lists are expanded
  // versions
  selectedVersionId: null,
  hiddenVersionIds: [],
  versionTransformOverride: null, // { versionId, transform } during drag
  // version compare
  versionCompareEnabled: false,
  versionCompareId: null, // ID of version to compare against active
  // calibration
  showCalibration: false,
  // Per-version calibration target positions (relative to image, 0..1)
  // { [versionId]: { red: {x, y}, green: {x, y} } }
  calibrationTargetsByVersionId: {},
};

export const baseMapEditorSlice = createSlice({
  name: "baseMapEditor",
  initialState: baseMapEditorInitialState,
  reducers: {
    setSelectedTab: (state, action) => {
      state.selectedTab = action.payload;
    },
    setGrayLevelThreshold: (state, action) => {
      state.grayLevelThreshold = action.payload;
    },
    // viewer
    setDisplayedBaseMapListingId: (state, action) => {
      state.displayedBaseMapListingId = action.payload;
    },
    setCreatingInListingId: (state, action) => {
      state.creatingInListingId = action.payload;
    },
    toggleListingCollapsed: (state, action) => {
      const id = action.payload;
      const idx = state.collapsedListingIds.indexOf(id);
      if (idx === -1) {
        state.collapsedListingIds.push(id);
      } else {
        state.collapsedListingIds.splice(idx, 1);
      }
    },
    toggleBaseMapVersionsExpanded: (state, action) => {
      const id = action.payload;
      const idx = state.expandedBaseMapVersionIds.indexOf(id);
      if (idx === -1) {
        state.expandedBaseMapVersionIds.push(id);
      } else {
        state.expandedBaseMapVersionIds.splice(idx, 1);
      }
    },
    // versions
    setSelectedVersionId: (state, action) => {
      state.selectedVersionId = action.payload;
    },
    setVersionTransformOverride: (state, action) => {
      state.versionTransformOverride = action.payload;
    },
    toggleVersionHidden: (state, action) => {
      const id = action.payload;
      const idx = state.hiddenVersionIds.indexOf(id);
      if (idx === -1) {
        state.hiddenVersionIds.push(id);
      } else {
        state.hiddenVersionIds.splice(idx, 1);
      }
    },
    setHiddenVersionIds: (state, action) => {
      state.hiddenVersionIds = action.payload;
    },
    // version compare
    setVersionCompareEnabled: (state, action) => {
      state.versionCompareEnabled = action.payload;
    },
    setVersionCompareId: (state, action) => {
      state.versionCompareId = action.payload;
    },
    resetVersionCompare: (state) => {
      state.versionCompareEnabled = false;
      state.versionCompareId = null;
    },
    // calibration
    setShowCalibration: (state, action) => {
      state.showCalibration = action.payload;
    },
    setCalibrationTargets: (state, action) => {
      const { versionId, red, green } = action.payload;
      state.calibrationTargetsByVersionId[versionId] = { red, green };
    },
  },
});

export const {
  setSelectedTab,
  setGrayLevelThreshold,
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleListingCollapsed,
  toggleBaseMapVersionsExpanded,
  setSelectedVersionId,
  setVersionTransformOverride,
  toggleVersionHidden,
  setHiddenVersionIds,
  setVersionCompareEnabled,
  setVersionCompareId,
  resetVersionCompare,
  setShowCalibration,
  setCalibrationTargets,
} = baseMapEditorSlice.actions;

export default baseMapEditorSlice.reducer;
