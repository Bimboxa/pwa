import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    toolsSectionCollapsed: false,
    // Template whose detail is open in the panel (#311). null = the main
    // templates list. detailView picks the open subview: the annotations
    // list, the template properties, or one annotation's properties
    // (detailAnnotationId).
    detailTemplateId: null,
    detailView: "ANNOTATIONS", // "ANNOTATIONS" | "PROPERTIES" | "ANNOTATION"
    detailAnnotationId: null,
    // Viewer module: annotations scope of the panel — the active base map
    // only, or the whole repérage (all base maps). Drives useAnnotationsV2
    // and thus every displayed quantity.
    viewerAnnotationsScope: "BASE_MAP", // "BASE_MAP" | "ALL"
  },
  reducers: {
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
    setViewerAnnotationsScope(state, action) {
      state.viewerAnnotationsScope = action.payload ?? "BASE_MAP";
    },
  },
});

export const {
  setToolsSectionCollapsed,
  setDetailTemplateId,
  setDetailView,
  setDetailAnnotationId,
  setViewerAnnotationsScope,
} = panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
