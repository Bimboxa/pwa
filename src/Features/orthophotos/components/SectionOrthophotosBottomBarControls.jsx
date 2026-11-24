import { useDispatch, useSelector } from "react-redux";

import { setShowStations } from "../orthophotosSlice";

import { Box, Divider, Typography } from "@mui/material";
import LinkedCamera from "@mui/icons-material/LinkedCamera";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";

import useOrthophotos from "../hooks/useOrthophotos";
import useIsMainBaseMapOrthophoto from "../hooks/useIsMainBaseMapOrthophoto";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";

// Bottom bar controls of the unit orthophotos: shown in the 2D editors while
// the main base map is an orthomosaic (baseMap.isOrthophoto). The toggle (and
// the count pill) switches the camera stations on / off over the editor —
// see LayerOrthophotos. Nothing under a capture / POV framing.
export default function SectionOrthophotosBottomBarControls() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Orthophotos";
  const showS = "Afficher les stations des orthophotos unitaires";
  const hideS = "Masquer les stations des orthophotos unitaires";

  // data

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const showStations = useSelector((s) => s.orthophotos.showStations);
  const isOrthophoto = useIsMainBaseMapOrthophoto();
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const orthophotos = useOrthophotos({
    baseMapId: isOrthophoto ? mainBaseMapId : null,
  });

  // helpers

  const is2dEditor =
    effectiveViewerKey === "MAP" || effectiveViewerKey === "BASE_MAPS";

  // handlers

  function handleToggle() {
    dispatch(setShowStations(!showStations));
  }

  // render

  if (!is2dEditor || captureFramingActive || !isOrthophoto) return null;

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
      <ButtonCountPill
        count={orthophotos.length}
        hidden={!showStations}
        title={showStations ? hideS : showS}
        onClick={handleToggle}
      />
      <ButtonBaseMapsGrid
        title={showStations ? hideS : showS}
        icon={<LinkedCamera />}
        active={showStations}
        onClick={handleToggle}
      />
      <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
    </Box>
  );
}
