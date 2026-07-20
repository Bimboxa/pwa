import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  clearDimensionDraft,
  setDimensionModeActive,
} from "Features/threedEditor/threedEditorSlice";

import { selectIsTemplateCoteDrawActive } from "../utils/templateCoteDrawSelectors";

// Bridges the template-driven cote-draw request (derived from the regular 2D
// drawing state set by the COTE template row click in PopperMapListings) into
// the 3D dimension (2-click) machinery — pointer handlers, snap overlay and
// the mutual-exclusion reducers are keyed on `threedEditor.dimensionMode
// .active`, which reducers cannot derive; this hook syncs the derived flag
// into it. Mirrors useTemplateFaceDrawBridge.
export default function useTemplateCoteDrawBridge() {
  const dispatch = useDispatch();

  const derivedActive = useSelector(selectIsTemplateCoteDrawActive);
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const templateId = useSelector(
    (s) => s.annotations.newAnnotation?.annotationTemplateId
  );

  // Derived request → machinery flag. Deactivation (template cleared, editor
  // toggled back to 2D, module switch) also clears the in-progress draft via
  // the reducer.
  const prevDerivedRef = useRef(derivedActive);
  useEffect(() => {
    const prev = prevDerivedRef.current;
    prevDerivedRef.current = derivedActive;
    if (derivedActive && !prev) {
      // Payload true also switches off drawing/move/meshing/walk modes.
      dispatch(setDimensionModeActive(true));
    } else if (!derivedActive && prev) {
      dispatch(setDimensionModeActive(false));
    }
  }, [derivedActive, dispatch]);

  // Machinery flag dropped while the request is still on (another 3D mode's
  // reducer takeover): clear the 2D drawing state so the derived request
  // follows. Transition-guarded — at activation this render still sees the
  // pre-dispatch (false) value.
  const prevDimensionActiveRef = useRef(dimensionActive);
  useEffect(() => {
    const prev = prevDimensionActiveRef.current;
    prevDimensionActiveRef.current = dimensionActive;
    if (derivedActive && prev && !dimensionActive) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }
  }, [dimensionActive, derivedActive, dispatch]);

  // Template switch mid-draw: keep the mode active but drop the start point —
  // the next cote belongs to the new template.
  const prevTemplateIdRef = useRef(templateId);
  useEffect(() => {
    const prev = prevTemplateIdRef.current;
    prevTemplateIdRef.current = templateId;
    if (derivedActive && prev && templateId && prev !== templateId) {
      dispatch(clearDimensionDraft());
    }
  }, [templateId, derivedActive, dispatch]);
}
