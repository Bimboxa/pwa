import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  cancelInProgressPolyline,
  setDrawingModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { selectIsTemplateFaceDrawActive } from "../utils/templateFaceDrawSelectors";

// Bridges the template-driven face-draw request (derived from the regular 2D
// drawing state set by the template row click in PopperMapListings) into the
// 3D drawing machinery. Unlike OBJECT_3D placement (a self-contained
// controller), the face-drawing machinery — pointer handlers, overlay, snap
// index, MainThreedEditor's pointer short-circuit and the mutual-exclusion
// reducers — is keyed on `threedEditor.drawingMode.active`, which reducers
// cannot derive; this hook syncs the derived flag into it.
export default function useTemplateFaceDrawBridge() {
  const dispatch = useDispatch();

  const derivedActive = useSelector(selectIsTemplateFaceDrawActive);
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
    }
  }, [derivedActive, dispatch]);

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
