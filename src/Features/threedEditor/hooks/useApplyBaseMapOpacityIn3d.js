import { useEffect } from "react";
import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors the 3D basemap opacity to the scene: the global
// `state.threedEditor.baseMapOpacityIn3d` plus the per-baseMap
// `opacityByBaseMapIdIn3d` overrides (baseMap properties panel). Independent
// from `baseMap.opacity` (DB) and from the 2D `mapEditor.baseMapOpacity` redux
// state. Mounted once from MainThreedEditor so opacity stays synced even when
// PanelBaseMapPosition3D (which only mounts in BASEMAP_POSITION mode) is
// closed.
//
// The applying is delegated to ImagesManager, which RECORDS the desired state:
// basemap meshes are attached asynchronously (texture load), so pushing the
// value only on redux change would miss every mesh born afterwards — the mesh
// would come in fully opaque while the slider still reads 0.2, and a fully
// opaque basemap writes depth and hides everything behind it.
//
// `rendererIsReady` MUST be a dependency: when this hook first runs the editor
// may not exist yet (the pass is then a no-op), and without it the pass that
// follows the editor creation never runs — the recorded state would stay at
// its default 1. Same contract as useApplyBaseMapVisibilityIn3d.
export default function useApplyBaseMapOpacityIn3d({ rendererIsReady } = {}) {
  const opacity = useSelector((s) => s.threedEditor.baseMapOpacityIn3d);
  const opacityById = useSelector((s) => s.threedEditor.opacityByBaseMapIdIn3d);

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager) return;
    imagesManager.setBaseMapOpacities({
      baseMapOpacityIn3d: opacity,
      opacityByBaseMapIdIn3d: opacityById,
    });
    editor.renderScene?.();
  }, [rendererIsReady, opacity, opacityById]);
}
