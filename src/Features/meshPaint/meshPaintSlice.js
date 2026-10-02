import { createSlice } from "@reduxjs/toolkit";

// UI state of the « Pinceau » (MESH_BRUSH): painted parts themselves live in
// db.meshPaints (see useMeshPaints).
const meshPaintSlice = createSlice({
  name: "meshPaint",
  initialState: {
    // Painted part highlighted in 3D from the template detail list (null:
    // none). Not a selection item on purpose: selection poppers / delete
    // hotkeys stay untouched.
    highlightedPaintId: null,
    // Bumped by requestMeshPaintFocus: the 3D layer frames the highlighted
    // paint once per bump.
    focusNonce: 0,
    // Annotations whose 3D object is built WITHOUT the anti-aliasing shrink
    // for the session (transition before the first paint row exists, or a
    // conversion to mesh). Hosts with live paints are exempt on their own
    // (derived from db.meshPaints).
    shrinkExemptAnnotationIds: [],
  },
  reducers: {
    setHighlightedMeshPaintId: (state, action) => {
      state.highlightedPaintId = action.payload ?? null;
    },
    requestMeshPaintFocus: (state, action) => {
      state.highlightedPaintId = action.payload ?? null;
      state.focusNonce += 1;
    },
    addShrinkExemptAnnotationIds: (state, action) => {
      const ids = (action.payload ?? []).filter(
        (id) => id && !state.shrinkExemptAnnotationIds.includes(id)
      );
      if (ids.length) state.shrinkExemptAnnotationIds.push(...ids);
    },
  },
  extraReducers: (builder) => {
    builder.addCase("scopes/setSelectedScopeId", (state) => {
      state.highlightedPaintId = null;
      state.shrinkExemptAnnotationIds = [];
    });
  },
});

export const {
  setHighlightedMeshPaintId,
  requestMeshPaintFocus,
  addShrinkExemptAnnotationIds,
} = meshPaintSlice.actions;

export default meshPaintSlice.reducer;
