import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // segment indices of the projectable chain currently shown in the elevation
  // editor (a segment `i` joins points[i] and points[i + 1])
  selectedSegmentIndices: [],
  // the principal segment, picked in the top plan view — defines the projection
  // line (droite) onto which the chain is projected and the stable layout of
  // the elevation editor below. Changing it re-projects + re-fits.
  seedSegmentIndex: null,
  // the segment currently being edited, picked by clicking a band in the
  // elevation editor. Only changes which vertices are draggable/highlighted —
  // it does NOT re-project or re-fit, so the bottom view stays stable.
  editedSegmentIndex: null,
  // segment hovered in a band / plan recap (single-segment highlight)
  hoveredSegmentIndex: null,
  // viewing side of the elevation (+1 / -1) — mirrors the projected X axis.
  // Chosen via the two arrows drawn on each side of the principal segment.
  observationSign: 1,
  // id of the annotation the current selection was computed for — used to
  // re-seed the default chain when the selected annotation changes
  selectionAnnotationId: null,
  // profileLines section mode: index of the edited profile (null = surface
  // silhouette mode). Synced from the map-editor sub-selection and the panel
  // chips.
  editedProfileIndex: null,
};

export const elevationSlice = createSlice({
  name: "elevation",
  initialState,
  reducers: {
    setSelectedSegmentIndices: (state, action) => {
      const { segmentIndices, seedSegmentIndex, annotationId } = action.payload;
      state.selectedSegmentIndices = segmentIndices ?? [];
      if (seedSegmentIndex !== undefined) {
        state.seedSegmentIndex = seedSegmentIndex;
        state.editedSegmentIndex = seedSegmentIndex;
        // reset the viewing side when the principal segment changes
        state.observationSign = 1;
      }
      if (annotationId !== undefined) state.selectionAnnotationId = annotationId;
    },
    setObservationSign: (state, action) => {
      state.observationSign = action.payload >= 0 ? 1 : -1;
    },
    setSeedSegmentIndex: (state, action) => {
      // principal segment (top plan): re-projects the editor; the edited
      // segment follows it so the principal is editable by default
      state.seedSegmentIndex = action.payload;
      state.editedSegmentIndex = action.payload;
    },
    setEditedSegmentIndex: (state, action) => {
      // band click: only changes which vertices are editable — keeps the
      // projection/layout stable
      state.editedSegmentIndex = action.payload;
    },
    setHoveredSegmentIndex: (state, action) => {
      state.hoveredSegmentIndex = action.payload;
    },
    setEditedProfileIndex: (state, action) => {
      state.editedProfileIndex = action.payload;
    },
    resetElevationSelection: () => initialState,
  },
});

export const {
  setSelectedSegmentIndices,
  setSeedSegmentIndex,
  setEditedSegmentIndex,
  setHoveredSegmentIndex,
  setObservationSign,
  setEditedProfileIndex,
  resetElevationSelection,
} = elevationSlice.actions;

export default elevationSlice.reducer;
