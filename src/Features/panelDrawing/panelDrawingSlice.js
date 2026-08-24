import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    templateFilter: "ALL", // "ALL" | "VISIBLE" | "HIDDEN"
    toolsSectionCollapsed: false,
    // Template whose detail is open in the panel (#311). null = the main
    // templates list. detailView picks the open subview: the annotations
    // list, the template properties, or one annotation's properties
    // (detailAnnotationId).
    detailTemplateId: null,
    detailView: "ANNOTATIONS", // "ANNOTATIONS" | "PROPERTIES" | "ANNOTATION"
    detailAnnotationId: null,
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
      state.detailAnnotationId = null;
    },
    setDetailView(state, action) {
      state.detailView = action.payload ?? "ANNOTATIONS";
      if (state.detailView !== "ANNOTATION") state.detailAnnotationId = null;
    },
    setDetailAnnotationId(state, action) {
      state.detailAnnotationId = action.payload ?? null;
      state.detailView = state.detailAnnotationId
        ? "ANNOTATION"
        : "ANNOTATIONS";
    },
  },
});

export const {
  setTemplateFilter,
  setToolsSectionCollapsed,
  setDetailTemplateId,
  setDetailView,
  setDetailAnnotationId,
} = panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
