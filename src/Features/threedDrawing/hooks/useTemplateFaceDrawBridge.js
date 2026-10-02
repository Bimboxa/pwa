import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  cancelInProgressPolyline,
  setDrawingModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { isFaceCutDrawingMode } from "Features/threedFaceCut/utils/faceCutTools";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";
import { selectIsMeshBrushActive } from "Features/meshPaint/utils/meshBrushSelectors";

import {
  selectIsFaceCutDrawActive,
  selectIsTemplateFaceDrawActive,
  selectIsThreedTemplatelessDrawActive,
} from "../utils/templateFaceDrawSelectors";

// Drawing modes that only exist in the 3D editor ("Coupe face", « Pinceau »):
// leaving the 3D editor (or the Dessin module) disarms them — the hidden 2D
// InteractionLayer has no use for their mode.
function isThreedOnlyDrawingMode(enabledDrawingMode) {
  return (
    isFaceCutDrawingMode(enabledDrawingMode) ||
    isMeshBrushDrawingMode(enabledDrawingMode)
  );
}

// Bridges the template-driven face-draw request (derived from the regular 2D
// drawing state set by the template row click in PopperMapListings) into the
// 3D drawing machinery. Unlike OBJECT_3D placement (a self-contained
// controller), the face-drawing machinery — pointer handlers, overlay, snap
// index, MainThreedEditor's pointer short-circuit and the mutual-exclusion
// reducers — is keyed on `threedEditor.drawingMode.active`, which reducers
// cannot derive; this hook syncs the derived flag into it.
//
// The template-less draw ("Dessin" tool in 3D,
// selectIsThreedTemplatelessDrawActive) and the "Coupe face" tool
// (selectIsFaceCutDrawActive) ride the same bridge: same machinery,
// different commit.
//
// The « Pinceau » (selectIsMeshBrushActive) rides it too, for the
// `drawingMode.active` guards only (no selection / lasso / hover tooltip
// clicks, hidden 2D InteractionLayer keys, delete hotkeys, label drags,
// mutual exclusion with the other 3D modes): the vertex-drawing machinery
// (useDrawingPointerHandlers, DrawingOverlayThreed) stays inert in that mode,
// the brush has its own pointer handlers.
export default function useTemplateFaceDrawBridge() {
  const dispatch = useDispatch();

  const derivedActive = useSelector(
    (s) =>
      selectIsTemplateFaceDrawActive(s) ||
      selectIsThreedTemplatelessDrawActive(s) ||
      selectIsFaceCutDrawActive(s) ||
      selectIsMeshBrushActive(s)
  );
  // "Coupe face" and « Pinceau » are 3D-only tools: leaving the 3D editor
  // disarms them (the 2D editor has no use for their drawing mode).
  const isThreedOnlyMode = useSelector((s) =>
    isThreedOnlyDrawingMode(s.mapEditor.enabledDrawingMode)
  );
  const isMeshBrushMode = useSelector((s) =>
    isMeshBrushDrawingMode(s.mapEditor.enabledDrawingMode)
  );
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const templateId = useSelector(
    (s) => s.annotations.newAnnotation?.annotationTemplateId
  );

  // Derived request → machinery flag. Deactivation (template cleared, editor
  // toggled back to 2D, module switch) also clears the in-progress polyline
  // and traits via the reducer.
  const prevDerivedRef = useRef(derivedActive);
  useEffect(() => {
    const prev = prevDerivedRef.current;
    prevDerivedRef.current = derivedActive;
    if (derivedActive && !prev) {
      // Payload true also switches off move/dimension/meshing/walk modes.
      dispatch(setDrawingModeActive(true));
    } else if (!derivedActive && prev) {
      dispatch(setDrawingModeActive(false));
      if (isThreedOnlyMode) {
        dispatch(setEnabledDrawingMode(null));
        dispatch(setNewAnnotation({}));
      }
    }
  }, [derivedActive, isThreedOnlyMode, dispatch]);

  // Machinery flag dropped while the request is still on (another 3D mode's
  // reducer takeover): clear the 2D drawing state so the derived request
  // follows. Transition-guarded — at activation this render still sees the
  // pre-dispatch (false) value.
  const prevDrawingActiveRef = useRef(drawingActive);
  useEffect(() => {
    const prev = prevDrawingActiveRef.current;
    prevDrawingActiveRef.current = drawingActive;
    if (derivedActive && prev && !drawingActive) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }
  }, [drawingActive, derivedActive, dispatch]);

  // Switch to the brush mid-draw (Tab, drawing toolbar): the path in progress
  // of the previous tool is dropped — the brush draws no vertex, and the path
  // would otherwise come back when switching to a drawing tool again.
  const prevMeshBrushModeRef = useRef(isMeshBrushMode);
  useEffect(() => {
    const prev = prevMeshBrushModeRef.current;
    prevMeshBrushModeRef.current = isMeshBrushMode;
    if (isMeshBrushMode && !prev && drawingActive) {
      dispatch(cancelInProgressPolyline());
    }
  }, [isMeshBrushMode, drawingActive, dispatch]);

  // Template switch mid-draw: keep the mode active but drop the in-progress
  // polyline — the next face belongs to the new template.
  const prevTemplateIdRef = useRef(templateId);
  useEffect(() => {
    const prev = prevTemplateIdRef.current;
    prevTemplateIdRef.current = templateId;
    if (derivedActive && prev && templateId && prev !== templateId) {
      dispatch(cancelInProgressPolyline());
    }
  }, [templateId, derivedActive, dispatch]);
}
