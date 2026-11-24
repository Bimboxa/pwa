import { useDispatch, useSelector } from "react-redux";

import { setShowReconstructionPlayer } from "../reconstruction3dSlice";

import { Box, Divider, Typography } from "@mui/material";
import SmartDisplayOutlined from "@mui/icons-material/SmartDisplayOutlined";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

import useReconstructionFrames from "../hooks/useReconstructionFrames";
import useIsMainBaseMapReconstruction3d from "../hooks/useIsMainBaseMapReconstruction3d";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Bottom bar control of a 3D reconstruction base map
// (baseMap.isReconstruction3d): shown in the 2D and 3D editors once the base
// map has images. The toggle opens the floating video / photos player
// (LayerReconstruction3d), which drives the camera of the 3D editor.
// Nothing under a capture / POV framing.
export default function SectionReconstruction3dBottomBarControls() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Reconstruction 3D";
  const showS = "Afficher la vidéo / les photos de la reconstruction";
  const hideS = "Masquer la vidéo / les photos de la reconstruction";

  // data

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const showPlayer = useSelector((s) => s.reconstruction3d.showPlayer);
  const isReconstruction = useIsMainBaseMapReconstruction3d();
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const frames = useReconstructionFrames({
    baseMapId: isReconstruction ? mainBaseMapId : null,
  });

  // helpers

  const isEditor =
    effectiveViewerKey === "MAP" ||
    effectiveViewerKey === "BASE_MAPS" ||
    isThreedFamilyViewerKey(effectiveViewerKey);

  // render

  if (
    !isEditor ||
    captureFramingActive ||
    !isReconstruction ||
    frames.length === 0
  )
    return null;

  return (
    <Box
      data-capture-hide
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 0.5,
        "& > .MuiPaper-root": {
          boxShadow: "none",
          border: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: "text.secondary" }}
      >
        {titleS}
      </Typography>
      <ButtonBaseMapsGrid
        title={showPlayer ? hideS : showS}
        icon={<SmartDisplayOutlined />}
        active={showPlayer}
        onClick={() => dispatch(setShowReconstructionPlayer(!showPlayer))}
      />
      <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
    </Box>
  );
}
