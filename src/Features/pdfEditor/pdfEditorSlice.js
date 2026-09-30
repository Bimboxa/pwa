import { createSlice } from "@reduxjs/toolkit";

import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// PDF editor: a layer sliding up over the displayed editor (2D or 3D),
// covering the whole editors area and staying under the right tools panel.
// Opened from the document links of the business objects
// (db.relsBusinessObjectResource). It is NOT an editor key of the
// module / editor model: the editor underneath stays mounted and untouched.
const initialState = {
  open: false,
  // PDF resource displayed. Kept on close so the content does not blank
  // during the slide-out.
  resourceId: null,
  // One-shot navigation target {pageNumber, highlightId?} — consumed then
  // cleared by the viewer (a repeat click on the same passage re-navigates).
  targetPdfPage: null,
  // Highlights of the linked passages shown on the pages (session).
  showHighlights: true,
  // "Sommaire" popper listing the linked passages of the document.
  passagesPopperOpen: false,
};

const close = (state) => {
  state.open = false;
  state.targetPdfPage = null;
  state.passagesPopperOpen = false;
};

const reset = (state) => {
  close(state);
  state.resourceId = null;
};

export const pdfEditorSlice = createSlice({
  name: "pdfEditor",
  initialState,
  reducers: {
    openPdfEditor: (state, action) => {
      const { resourceId, pageNumber, highlightId } = action.payload ?? {};
      if (!resourceId) return;
      state.open = true;
      state.resourceId = resourceId;
      state.targetPdfPage = {
        pageNumber: pageNumber ?? 1,
        highlightId: highlightId ?? null,
      };
      // A targeted passage must be visible.
      if (highlightId) state.showHighlights = true;
    },
    closePdfEditor: close,
    // Document switch from the editor's own selector: page 1 of the new one.
    setPdfEditorResourceId: (state, action) => {
      state.resourceId = action.payload ?? null;
      state.targetPdfPage = null;
    },
    setPdfEditorTargetPage: (state, action) => {
      state.targetPdfPage = action.payload ?? null;
    },
    setPdfEditorShowHighlights: (state, action) => {
      state.showHighlights = Boolean(action.payload);
    },
    setPdfEditorPassagesPopperOpen: (state, action) => {
      state.passagesPopperOpen = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // The document belongs to the displayed project / scope.
      .addCase("scopes/setSelectedScopeId", reset)
      .addCase("projects/setSelectedProjectId", reset)
      // The layer follows the modules it is opened from (the business-objects
      // modules and the Viewer, whose drawers list the objects): clicking a
      // highlight may switch between them. Any other module closes it — the
      // layer would otherwise cover the Table / Portfolio / Scope viewers and
      // leave the Dessin hotkeys acting on a hidden editor.
      .addCase("viewers/setSelectedViewerKey", (state, action) => {
        const moduleKey = action.payload;
        if (moduleKey === "THREED" || isBusinessObjectsModuleKey(moduleKey))
          return;
        close(state);
      });
  },
});

export const {
  openPdfEditor,
  closePdfEditor,
  setPdfEditorResourceId,
  setPdfEditorTargetPage,
  setPdfEditorShowHighlights,
  setPdfEditorPassagesPopperOpen,
} = pdfEditorSlice.actions;

export const selectPdfEditorOpen = (s) => s.pdfEditor.open;

export default pdfEditorSlice.reducer;
