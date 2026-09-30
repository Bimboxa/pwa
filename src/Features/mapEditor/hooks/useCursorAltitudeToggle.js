import { useCallback } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setCursorAltitudeEnabled } from "Features/mapEditor/mapEditorSlice";

import { saveCursorAltitudeEnabled } from "Features/mapEditor/services/editorSettingsLocalStorage";

// The "altimetry under the cursor" preference: redux flag + device
// persistence, shared by the settings switch and the bottom-left button.
export default function useCursorAltitudeToggle() {
  const dispatch = useDispatch();
  const enabled = useSelector((s) => s.mapEditor.cursorAltitudeEnabled);

  const setEnabled = useCallback(
    (next) => {
      dispatch(setCursorAltitudeEnabled(next));
      saveCursorAltitudeEnabled(next);
    },
    [dispatch]
  );

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  return { enabled, setEnabled, toggle };
}
