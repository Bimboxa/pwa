import { useCallback } from "react";
import { useSelector } from "react-redux";

import { selectBaseMapsGridMounted } from "Features/baseMapsGrid/baseMapsGridSlice";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";

import useZoomOutHotkey, { ZOOM_OUT_HOTKEY } from "../hooks/useZoomOutHotkey";

import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

// 2D twin of ButtonZoomOutThreed: re-fit the camera so the base map fills the
// visible editor viewport (the default camera matrix). Positioned by its
// parent — the bottom-right row of UILayerDesktop, left of the 2D/3D toggle,
// mirroring the 3D editor layout. "Z" hotkey from the displayed 2D instance only (`isActiveViewer`:
// the MAP and BASE_MAPS instances may both be mounted), never while a
// drawing tool owns the key, nor under the PDF editor / base maps grid layers.
export default function ButtonZoomOutMap({
  onResetCamera,
  isActiveViewer,
  shortcutPlacement,
}) {
  // strings

  const titleS = "Zoom out";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const pdfEditorOpen = useSelector(selectPdfEditorOpen);
  const baseMapsGridMounted = useSelector(selectBaseMapsGridMounted);

  // handlers

  const handleClick = useCallback(() => {
    onResetCamera?.();
  }, [onResetCamera]);

  useZoomOutHotkey({
    enabled:
      Boolean(isActiveViewer) &&
      !enabledDrawingMode &&
      !pdfEditorOpen &&
      !baseMapsGridMounted,
    onZoomOut: handleClick,
  });

  // render

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<ZoomOutMapIcon />}
      shortcut={ZOOM_OUT_HOTKEY}
      shortcutPlacement={shortcutPlacement}
      onClick={handleClick}
    />
  );
}
