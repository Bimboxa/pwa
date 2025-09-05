import { useEffect } from "react";

import { useSelector } from "react-redux";

import editor from "App/editor";
import useBgImageInMapEditor from "./useBgImageInMapEditor";

export default function useAutoSetMapEditorConfig() {
  // SCOPE ID

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  useEffect(() => {
    if (editor.mapEditor) {
      editor.mapEditor.scopeId = scopeId;
    }
  }, [scopeId]);

  // BG IMAGE

  const bgImage = useBgImageInMapEditor();

  useEffect(() => {
    console.log("debug_0827 set bgImage", bgImage);
    if (editor?.mapEditor && bgImage) {
      editor?.mapEditor.setBgImage(bgImage);
    }
  }, [editor?.mapEditor, bgImage?.imageUrlRemote]);
}
