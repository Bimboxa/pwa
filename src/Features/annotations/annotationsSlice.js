import { createSlice } from "@reduxjs/toolkit";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";

// Modules displaying the annotations recap drawer (PanelAnnotationsRecap in
// SectionViewer): the template focus survives switches between them.
const RECAP_PANEL_MODULE_KEYS = ["MAP", "THREED"];

//import demoAnnotation from "./data/demoAnnotation";

const annotationsInitialState = {
  //
  annotationsUpdatedAt: null,
  annotationTemplatesUpdatedAt: null,
  //
  // "Maillage": single shared flag for both the 2D map editor and the 3D
  // viewer. When true, meshed parents are replaced by their mesh cells
  // ("mailles" M1, M2…). Auto-reset to false when no mesh cells remain (the
  // toggle is hidden in that case, so it couldn't be turned off by hand).
  showMeshCells: false,
  //
  selectedAnnotationTemplateId: null,
  //
  // Style defaults are now provided by DRAWING_SHAPE_CONFIG at template selection time.
  // This object holds transient state during drawing; style props come from the template.
  newAnnotation: {},
  // props used when adding a annotation
  editedAnnotation: null,
  isEditingAnnotation: false,
  //
  annotationTemplatesById: {}, // {id:MARKER_#234513_square,label}
  tempAnnotationTemplateLabel: null,
  //
  editedAnnotationTemplate: null, // used to update annotation template
  //
  tempAnnotations: [],
  //
  openDialogDeleteSelectedAnnotation: false,
  openDialogSaveTempAnnotations: false,
  //
  // Template FOCUS (Dessin module's recap panel): only the annotations of
  // this template stay visible (2D) / undimmed (3D). Applied in
  // useAnnotationsV2 next to the zone solo, same ignoreSolo/keepSoloDimmed
  // semantics.
  soloAnnotationTemplateId: null,
  // Single-annotation FOCUS (panel annotation detail "Isoler"): same
  // semantics, keyed on the annotation id.
  soloAnnotationId: null,
};

export const annotationsSlice = createSlice({
  name: "annotations",
  initialState: annotationsInitialState,
  reducers: {
    setSelectedAnnotationId: (state, action) => {
      state.selectedAnnotationId = action.payload;
    },
    //
    createAnnotation: (state, action) => {
      const annotation = action.payload;
      state.annotationsMap[annotation.id] = annotation;
      state.annotationsUpdatedAt = Date.now();
    },
    //
    triggerAnnotationsUpdate: (state) => {
      state.annotationsUpdatedAt = Date.now();
    },
    setShowMeshCells: (state, action) => {
      state.showMeshCells = action.payload;
    },
    triggerAnnotationTemplatesUpdate: (state) => {
      state.annotationTemplatesUpdatedAt = Date.now();
    },
    //
    setNewAnnotation: (state, action) => {
      state.newAnnotation = action.payload;
    },
    // Shallow-merge a partial into the draft. Used by the E/H typed-entry
    // machine to live-patch a single field (strokeWidth / height) without
    // needing a fresh spread of the whole newAnnotation from the caller.
    patchNewAnnotation: (state, action) => {
      state.newAnnotation = { ...state.newAnnotation, ...action.payload };
    },
    setEditedAnnotation: (state, action) => {
      state.editedAnnotation = action.payload;
    },
    setIsEditingAnnotation: (state, action) => {
      state.isEditingAnnotation = action.payload;
    },

    // annotation templates
    setAnnotationTemplatesById: (state, action) => {
      state.annotationTemplatesById = action.payload;
    },
    setTempAnnotationTemplateLabel: (state, action) => {
      state.tempAnnotationTemplateLabel = action.payload;
    },
    setEditedAnnotationTemplate: (state, action) => {
      state.editedAnnotationTemplate = action.payload;
    },

    // temp annotations
    setTempAnnotations: (state, action) => {
      state.tempAnnotations = action.payload;
    },
    updateTempAnnotation: (state, action) => {
      const { id, ...props } = action.payload;
      const tempAnnotation = state.tempAnnotations.find((a) => a.id === id);
      if (tempAnnotation) {
        Object.assign(tempAnnotation, props);
      }
    },
    //
    setOpenDialogDeleteSelectedAnnotation: (state, action) => {
      state.openDialogDeleteSelectedAnnotation = action.payload;
    },
    setOpenDialogSaveTempAnnotations: (state, action) => {
      state.openDialogSaveTempAnnotations = action.payload;
    },
    setSoloAnnotationTemplateId: (state, action) => {
      state.soloAnnotationTemplateId = action.payload ?? null;
    },
    setSoloAnnotationId: (state, action) => {
      state.soloAnnotationId = action.payload ?? null;
    },
  },
  extraReducers: (builder) => {
    // Leaving the recap-panel modules (Dessin, Viewer) clears the template
    // focus. Keyed on the MODULE switch (not on a viewer unmount): the 2D↔3D
    // editor toggle (T) swaps the displayed editor while the module stays
    // selected, and the focus must survive it — same pattern as zoningsSlice's
    // zone solo.
    builder.addCase(setSelectedViewerKey, (state, action) => {
      if (!RECAP_PANEL_MODULE_KEYS.includes(action.payload)) {
        state.soloAnnotationTemplateId = null;
        state.soloAnnotationId = null;
      }
    });
    // Scope switch: the focused template belongs to the previous scope — a
    // stale id would hide every annotation of the new scope (nothing matches).
    // Needed because the Viewer-landing dispatch no longer clears the focus
    // (THREED is a recap-panel module).
    builder.addCase(setSelectedScopeId, (state) => {
      state.soloAnnotationTemplateId = null;
      state.soloAnnotationId = null;
    });
  },
});

export const {
  setSelectedAnnotationId,
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
  setShowMeshCells,
  //
  createAnnotation,
  //
  setNewAnnotation,
  patchNewAnnotation,
  setEditedAnnotation,
  setIsEditingAnnotation,
  //
  setTempAnnotationTemplateLabel,
  setEditedAnnotationTemplate,
  //
  setTempAnnotations,
  updateTempAnnotation,
  //
  setOpenDialogDeleteSelectedAnnotation,
  setOpenDialogSaveTempAnnotations,
  //
  setSoloAnnotationTemplateId,
  setSoloAnnotationId,
} = annotationsSlice.actions;

export default annotationsSlice.reducer;
