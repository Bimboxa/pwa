import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    templateFilter: "ALL", // "ALL" | "VISIBLE" | "HIDDEN"
    toolsSectionCollapsed: false,
    // Template whose annotations list is open in the panel (detail view,
    // #311). null = the main templates list.
    detailTemplateId: null,
  },
  reducers: {
    setTemplateFilter(state, action) {
      state.templateFilter = action.payload;
    },
    setToolsSectionCollapsed(state, action) {
      state.toolsSectionCollapsed = action.payload;
    },
    setDetailTemplateId(state, action) {
      state.detailTemplateId = action.payload ?? null;
    },
  },
});

export const {
  setTemplateFilter,
  setToolsSectionCollapsed,
  setDetailTemplateId,
} = panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
