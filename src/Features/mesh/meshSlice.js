import { createSlice, nanoid } from "@reduxjs/toolkit";

// State for the "Maillage" (mesh) tool: subdivide the selected annotation into
// mesh cells via horizontal/vertical cut lines.
//
// `draftMeshLines` is the working copy of the cut lines while editing. Lines are
// kept in the editor's WORLD space (map pixels for a POLYGON, elevation pixels
// for a POLYLINE). They are normalized only when persisted (see
// saveMeshService / setAnnotationMeshLinesService). Each line:
//   { id, orientation: "VERTICAL" | "HORIZONTAL" | "FREE", p1:{x,y}, p2:{x,y} }
const initialState = {
  // whether the mesh edition mode is active (cut lines are shown/editable)
  editing: false,
  // active drawing tool:
  //   null | "SELECT" | "ADD_VERTICAL" | "ADD_HORIZONTAL" | "ADD_FREE" | "GRID"
  activeTool: null,
  // working copy of the cut lines (world space)
  draftMeshLines: [],
  // currently selected / hovered cut line (by id)
  selectedLineId: null,
  hoveredLineId: null,
  // id of the annotation the draft was loaded for — used to reset the draft
  // when the selected annotation changes
  selectionAnnotationId: null,
  // grid tool: target cell size in meters (width × height)
  gridCell: { width: 1, height: 1 },
  // whether the current draft yields at least one cell (drives the header's
  // "Enregistrer" disabled state — set by the editor as cells recompute)
  canSave: false,
};

export const meshSlice = createSlice({
  name: "mesh",
  initialState,
  reducers: {
    startMeshEditing: (state, action) => {
      const { annotationId, meshLines } = action.payload;
      state.editing = true;
      state.activeTool = "SELECT";
      // `meshLines` is optional: when provided (legacy callers) we seed the
      // draft directly; otherwise MeshEditor seeds it from the persisted lines
      // via a layout effect (it owns the developedRange needed for POLYLINE).
      if (meshLines) state.draftMeshLines = meshLines;
      state.selectedLineId = null;
      state.hoveredLineId = null;
      state.selectionAnnotationId = annotationId ?? null;
    },
    stopMeshEditing: (state) => {
      state.editing = false;
      state.activeTool = null;
      state.selectedLineId = null;
      state.hoveredLineId = null;
      state.canSave = false;
    },
    setActiveTool: (state, action) => {
      state.activeTool = action.payload;
    },
    addMeshLine: (state, action) => {
      const line = { id: action.payload.id ?? nanoid(), ...action.payload };
      state.draftMeshLines.push(line);
      state.selectedLineId = line.id;
      // back to selection mode after placing a single line
      state.activeTool = "SELECT";
    },
    setMeshLines: (state, action) => {
      state.draftMeshLines = action.payload ?? [];
      state.selectedLineId = null;
    },
    updateMeshLine: (state, action) => {
      const { id, p1, p2 } = action.payload;
      const line = state.draftMeshLines.find((l) => l.id === id);
      if (!line) return;
      if (p1) line.p1 = p1;
      if (p2) line.p2 = p2;
    },
    removeMeshLine: (state, action) => {
      state.draftMeshLines = state.draftMeshLines.filter(
        (l) => l.id !== action.payload
      );
      if (state.selectedLineId === action.payload) state.selectedLineId = null;
    },
    setMeshGridCell: (state, action) => {
      state.gridCell = { ...state.gridCell, ...action.payload };
    },
    setMeshCanSave: (state, action) => {
      state.canSave = action.payload;
    },
    setSelectedLineId: (state, action) => {
      state.selectedLineId = action.payload;
    },
    setHoveredLineId: (state, action) => {
      state.hoveredLineId = action.payload;
    },
    resetMesh: () => initialState,
  },
});

export const {
  startMeshEditing,
  stopMeshEditing,
  setActiveTool,
  addMeshLine,
  setMeshLines,
  updateMeshLine,
  removeMeshLine,
  setMeshGridCell,
  setMeshCanSave,
  setSelectedLineId,
  setHoveredLineId,
  resetMesh,
} = meshSlice.actions;

export default meshSlice.reducer;
