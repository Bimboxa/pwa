import { useCallback } from "react";
import { useSelector } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import useZoomOutHotkey, {
  ZOOM_OUT_HOTKEY,
} from "Features/mapEditor/hooks/useZoomOutHotkey";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

// Fire-and-forget button. In the Dessin module (selectedViewerKey "MAP" shown
// in 3D) it re-frames the camera on the MAIN base map (the one of the top-bar
// selector): centered, image upright, slightly tilted for a horizontal plan or
// shifted right for a vertical one (see ThreedEditor.fitToBaseMap). In the
// other modules — or when that base map is not framable (not loaded, no
// scale) — it encompasses all annotations currently shown in the scene (the
// useAnnotationsV2 set); with no annotation it frames a 10 m cube at the
// world center (see ControlsManager.fitToAnnotations).
// Positioned by its parent — the top-right overlay row of MainThreedEditor,
// between the base map image mode selector and the base maps grid button,
// outside the bottom-toolbar swap so it stays available whatever toolbar is
// active (drawing, meshing, extrude, …). "Z" hotkey while a 3D editor is
// displayed, except in walk mode (its own keyboard: Z = forward) and while
// drawing (Z = rectangle dimension / axis key).
export default function ButtonZoomOutThreed() {
  // strings

  const titleS = "Zoom out";

  // data

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const isDessinModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "MAP"
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // handlers

  const handleClick = useCallback(async () => {
    const editor = getActiveThreedEditor();
    if (!editor) return;
    if (isDessinModule && mainBaseMapId) {
      const framed = await editor.fitToBaseMap?.(mainBaseMapId);
      if (framed) return;
    }
    editor.fitToAnnotations?.();
  }, [isDessinModule, mainBaseMapId]);

  useZoomOutHotkey({
    enabled:
      isThreedFamilyViewerKey(effectiveViewerKey) &&
      !walkActive &&
      !drawingActive,
    onZoomOut: handleClick,
  });

  // render

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<ZoomOutMapIcon />}
      shortcut={ZOOM_OUT_HOTKEY}
      onClick={handleClick}
    />
  );
}
