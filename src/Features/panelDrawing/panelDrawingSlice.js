import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    templateFilter: "ALL", // "ALL" | "VISIBLE" | "HIDDEN"
    toolsSectionCollapsed: false,
    // Template whose detail is open in the panel (#311). null = the main
    // templates list. detailView picks the open subview: the annotations
    // list or the template properties.
    detailTemplateId: null,
    detailView: "ANNOTATIONS", // "ANNOTATIONS" | "PROPERTIES"
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
      state.detailView = "ANNOTATIONS";
    },
    setDetailView(state, action) {
      state.detailView = action.payload ?? "ANNOTATIONS";
    },
  },
});

export const {
  setTemplateFilter,
  setToolsSectionCollapsed,
  setDetailTemplateId,
  setDetailView,
} = panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
