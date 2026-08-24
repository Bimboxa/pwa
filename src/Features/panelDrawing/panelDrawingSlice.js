import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    templateFilter: "ALL", // "ALL" | "VISIBLE" | "HIDDEN"
    toolsSectionCollapsed: false,
  },
  reducers: {
    setTemplateFilter(state, action) {
      state.templateFilter = action.payload;
    },
    setToolsSectionCollapsed(state, action) {
      state.toolsSectionCollapsed = action.payload;
    },
  },
});

export const { setTemplateFilter, setToolsSectionCollapsed } =
  panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
