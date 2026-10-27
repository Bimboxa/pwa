import { useEffect } from "react";
import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { BASE_MAPS_SCAN_MODE } from "Features/baseMaps/constants/baseMapsScanMode";

// Mirrors the bottom bar « Scan 3D » mode (viewers.baseMapsScanMode) and the
// main base map to ImagesManager, which attaches the point clouds of the
// base maps projected from a local scan. Same record-then-apply contract
// (and `rendererIsReady` dependency) as useApplyBaseMapOpacityIn3d.
export default function useApplyBaseMapsScanModeIn3d({ rendererIsReady } = {}) {
  // Never chosen (null): no point cloud is loaded.
  const mode = useSelector(
    (s) => s.viewers.baseMapsScanMode ?? BASE_MAPS_SCAN_MODE.NONE
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  useEffect(() => {
    const imagesManager = getActiveThreedEditor()?.sceneManager?.imagesManager;
    imagesManager?.setLocalScanState({ mode, mainBaseMapId });
  }, [rendererIsReady, mode, mainBaseMapId]);
}
