import { useEffect } from "react";

import { useSelector } from "react-redux";

import useSelectedBaseMapViewInEditor from "Features/baseMapViews/hooks/useSelectedBaseMapViewInEditor";

import editor from "App/editor";
export default function useAutoSetMapEditorConfig() {
  // SCOPE ID

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  useEffect(() => {
    if (editor.mapEditor) {
      editor.mapEditor.scopeId = scopeId;
    }
  }, [scopeId]);

  // BG IMAGE

  const baseMapView = useSelectedBaseMapViewInEditor();

  const bgImage = baseMapView?.bgImage;

  useEffect(() => {
    if (editor?.mapEditor) {
      editor?.mapEditor.setBgImage(bgImage);
    }
  }, [bgImage?.imageUrlRemote, editor?.mapEditor]);

  // PRINT MODE

  const printModeEnabled = useSelector((s) => s.mapEditor.printModeEnabled);

  useEffect(() => {
    if (editor.mapEditor) {
      if (printModeEnabled) {
        editor.mapEditor.enablePrintMode();
      } else {
        editor.mapEditor.disablePrintMode();
      }
    }
  }, [printModeEnabled, editor?.mapEditor]);
}
