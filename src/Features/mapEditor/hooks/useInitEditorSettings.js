import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setVertexSizeMultiplier } from "Features/mapEditor/mapEditorSlice";

import { loadVertexSizeMultiplier } from "Features/mapEditor/services/editorSettingsLocalStorage";

// Restores persisted 2D editor settings (localStorage) into Redux on startup.
export default function useInitEditorSettings() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setVertexSizeMultiplier(loadVertexSizeMultiplier()));
  }, [dispatch]);
}
