import { createSlice } from "@reduxjs/toolkit";

const panelDrawingSlice = createSlice({
  name: "panelDrawing",
  initialState: {
    // Template whose detail is open in the panel (#311). null = the main
    // templates list. detailView picks the open subview: the annotations
    // list, the template properties, or one annotation's properties
    // (detailAnnotationId).
    detailTemplateId: null,
    detailView: "ANNOTATIONS", // "ANNOTATIONS" | "PROPERTIES" | "ANNOTATION"
    detailAnnotationId: null,
    // Annotations scope of the Dessin / Viewer panels and of the Dessin popper
    // (PopperMapListings footer switch): the active base map only, or the
    // whole repérage (all base maps, the default). Drives useAnnotationsV2
    // and thus every displayed quantity.
    viewerAnnotationsScope: "ALL", // "BASE_MAP" | "ALL"
    // Viewer module: content of the panel — the annotations, or the business
    // objects of one type (business object type key). A stale key falls back
    // to the annotations at read time (useViewerPanelTabs).
    viewerPanelTab: "ANNOTATIONS", // "ANNOTATIONS" | business object type key
    // Viewer module: listing displayed per business object type. Own slot —
    // businessObjects.selectedListingId belongs to the business-objects
    // modules, which auto-write it.
    viewerBusinessObjectListingIdByType: {},
    // "Visibilité auto" option of the "Listes" header menu: selecting a
    // listing hides every other listing and unhides all its templates.
    autoListingVisibility: false,
  },
  reducers: {
    setDetailTemplateId(state, action) {
      state.detailTemplateId = action.payload ?? null;
      // Opening a template lands on its properties; the annotations list is
      // reached from the "N annotations" card of the properties subview.
      state.detailView = "PROPERTIES";
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
      state.viewerAnnotationsScope = action.payload ?? "ALL";
    },
    setViewerPanelTab(state, action) {
      state.viewerPanelTab = action.payload ?? "ANNOTATIONS";
    },
    setViewerBusinessObjectListingId(state, action) {
      const { typeKey, listingId } = action.payload ?? {};
      if (!typeKey) return;
      state.viewerBusinessObjectListingIdByType[typeKey] = listingId ?? null;
    },
    setAutoListingVisibility(state, action) {
      state.autoListingVisibility = Boolean(action.payload);
    },
  },
});

export const {
  setDetailTemplateId,
  setDetailView,
  setDetailAnnotationId,
  setViewerAnnotationsScope,
  setViewerPanelTab,
  setViewerBusinessObjectListingId,
  setAutoListingVisibility,
} = panelDrawingSlice.actions;

export default panelDrawingSlice.reducer;
