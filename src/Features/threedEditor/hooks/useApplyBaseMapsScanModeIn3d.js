import { useEffect, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import {
  getLocalScanHeightMapVersion,
  subscribeLocalScanHeightMapVersion,
} from "Features/localScans/services/localScanHeightMapService";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { BASE_MAPS_SCAN_MODE } from "Features/baseMaps/constants/baseMapsScanMode";

// Mirrors the bottom bar « Scan 3D » mode (viewers.baseMapsScanMode) and the
// main base map and the « Scan » chips to ImagesManager, which attaches the point clouds of the
// base maps projected from a local scan. Same record-then-apply contract
// (and `rendererIsReady` dependency) as useApplyBaseMapOpacityIn3d.
export default function useApplyBaseMapsScanModeIn3d({ rendererIsReady } = {}) {
  // Never chosen (null): no point cloud is loaded.
  const mode = useSelector(
    (s) => s.viewers.baseMapsScanMode ?? BASE_MAPS_SCAN_MODE.NONE
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  // « Scan » chip off in the base maps list.
  const hiddenIds = useSelector(
    (s) => s.threedEditor.hiddenScene3dBaseMapIdsIn3d
  );
  // Bottom bar « Zmap » + the height map rebuilds (the meshes follow).
  const zMap = useSelector((s) => s.viewers.baseMapsZMapVisible);
  const zMapTick = useSyncExternalStore(
    subscribeLocalScanHeightMapVersion,
    getLocalScanHeightMapVersion
  );

  useEffect(() => {
    const imagesManager = getActiveThreedEditor()?.sceneManager?.imagesManager;
    imagesManager?.setLocalScanState({
      mode,
      mainBaseMapId,
      hiddenBaseMapIds: hiddenIds ?? [],
      zMap: Boolean(zMap),
      zMapTick,
    });
  }, [rendererIsReady, mode, mainBaseMapId, hiddenIds, zMap, zMapTick]);
}
