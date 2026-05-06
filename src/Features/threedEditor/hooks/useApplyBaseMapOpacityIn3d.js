import { useEffect } from "react";
import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Mirrors `state.threedEditor.baseMapOpacityIn3d` to every basemap mesh's
// material in the active 3D editor. Independent from `baseMap.opacity` (DB)
// and from the 2D `mapEditor.baseMapOpacity` Redux state. Mounted once from
// MainThreedEditor so opacity stays synced even when PanelBaseMapPosition3D
// (which only mounts in BASEMAP_POSITION mode) is closed.
export default function useApplyBaseMapOpacityIn3d() {
  const opacity = useSelector((s) => s.threedEditor.baseMapOpacityIn3d);

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const imagesMap = editor?.sceneManager?.imagesManager?.imagesMap;
    if (!imagesMap) return;
    Object.values(imagesMap).forEach((group) => {
      group.traverse?.((child) => {
        if (child.userData?.isBasemap && child.material) {
          // Never touch `transparent` — the mesh is created with
          // `transparent: true` once and stays in that queue, so dragging
          // through 1.0 doesn't trigger a render-queue swap. `depthWrite`
          // toggles with opacity===1 so that a translucent basemap doesn't
          // occlude transparent annotations behind it (see createImageObject
          // for the full rationale).
          child.material.opacity = opacity;
          child.material.depthWrite = opacity >= 1;
        }
      });
    });
    editor.renderScene?.();
  }, [opacity]);
}
