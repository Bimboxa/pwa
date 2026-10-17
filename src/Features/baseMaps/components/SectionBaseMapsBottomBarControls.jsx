import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import SelectorBaseMapsImageMode from "./SelectorBaseMapsImageMode";
import ButtonOpenBaseMapsGrid from "Features/baseMapsGrid/components/ButtonOpenBaseMapsGrid";
import ButtonOpenBaseMapsGrid3d from "Features/baseMapsGrid3d/components/ButtonOpenBaseMapsGrid3d";

import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Bottom bar controls of the displayed editor: the base map image display
// mode (hidden / faded / as is) and the base maps grid button (2D grid layer,
// or the 3D "lay the base maps flat" mode) — formerly the top-right row of
// the editors. Rendered for the 2D map editors and the 3D editor; the
// Maillage module (meshing-only) has neither; nothing under a capture / POV
// framing. The hotkey badges hang above the buttons (bottom edge).
export default function SectionBaseMapsBottomBarControls() {
  // data

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  // helpers

  const is2dEditor =
    effectiveViewerKey === "MAP" || effectiveViewerKey === "BASE_MAPS";
  const is3dEditor = isThreedFamilyViewerKey(effectiveViewerKey) && !disable3D;
  const isMeshesViewer = viewerKey === "MESHES";

  // render

  if ((!is2dEditor && !is3dEditor) || isMeshesViewer || captureFramingActive)
    return null;

  return (
    <Box
      data-capture-hide
      sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}
    >
      <SelectorBaseMapsImageMode />
      {is3dEditor ? <ButtonOpenBaseMapsGrid3d /> : <ButtonOpenBaseMapsGrid />}
    </Box>
  );
}
