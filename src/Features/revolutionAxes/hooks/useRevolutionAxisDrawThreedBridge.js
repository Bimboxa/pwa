import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setRevolutionAxisDrawModeActive } from "Features/threedEditor/threedEditorSlice";

import { selectIsRevolutionAxisDrawThreedActive } from "../utils/revolutionAxisDrawThreedSelectors";

// Bridges the axis-draw request (derived from the regular 2D drawing state
// armed by the "Axe de révolution" tool row) into the 3D two-click axis
// machinery — pointer handlers, draft overlay and the mutual-exclusion
// reducers are keyed on `threedEditor.revolutionAxisDrawMode.active`, which
// reducers cannot derive. Mirrors useTemplateCoteDrawBridge.
export default function useRevolutionAxisDrawThreedBridge() {
  const dispatch = useDispatch();

  const derivedActive = useSelector(selectIsRevolutionAxisDrawThreedActive);
  const modeActive = useSelector(
    (s) => s.threedEditor.revolutionAxisDrawMode.active
  );

  // Derived request → machinery flag (deactivation also clears the draft).
  const prevDerivedRef = useRef(derivedActive);
  useEffect(() => {
    const prev = prevDerivedRef.current;
    prevDerivedRef.current = derivedActive;
    if (derivedActive && !prev) {
      dispatch(setRevolutionAxisDrawModeActive(true));
    } else if (!derivedActive && prev) {
      dispatch(setRevolutionAxisDrawModeActive(false));
    }
  }, [derivedActive, dispatch]);

  // Machinery flag dropped while the request is still on (another 3D mode's
  // reducer takeover): clear the 2D drawing state so the request follows.
  const prevModeActiveRef = useRef(modeActive);
  useEffect(() => {
    const prev = prevModeActiveRef.current;
    prevModeActiveRef.current = modeActive;
    if (derivedActive && prev && !modeActive) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }
  }, [modeActive, derivedActive, dispatch]);
}
