import { useEffect } from "react";
import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors the bottom bar « Scan 3D » mode (viewers.baseMapsScanMode) and the
// main base map to ImagesManager, which attaches the point clouds of the
// base maps projected from a local scan. Same record-then-apply contract
// (and `rendererIsReady` dependency) as useApplyBaseMapOpacityIn3d.
export default function useApplyBaseMapsScanModeIn3d({ rendererIsReady } = {}) {
  const mode = useSelector((s) => s.viewers.baseMapsScanMode);
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  useEffect(() => {
    const imagesManager = getActiveThreedEditor()?.sceneManager?.imagesManager;
    imagesManager?.setLocalScanState({ mode, mainBaseMapId });
  }, [rendererIsReady, mode, mainBaseMapId]);
}
