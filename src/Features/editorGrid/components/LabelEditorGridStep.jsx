import { Typography } from "@mui/material";

import useMapZoom from "Features/mapEditorGeneric/hooks/useMapZoom";
import useEditorGrid from "../hooks/useEditorGrid";

import getDisplayedGridStepM, {
  getPxPerMeter,
} from "../utils/getDisplayedGridStepM";
import formatGridStep from "../utils/formatGridStep";

// Small caption of the dynamic editor grid: the size of one cell, which
// changes with the zoom level. Shown next to the scale indicator (bottom
// left of the 2D editor); nothing in fixed mode, where the cell size is the
// one picked in the « Grille » menu.
export default function LabelEditorGridStep({ meterByPx, basePoseK = 1 }) {
  // strings

  const cellS = "Maille";

  // data

  const { enabled, stepM, dynamic } = useEditorGrid();
  const active = enabled && dynamic;
  const zoom = useMapZoom(active);

  // helpers

  const displayedStepM = active
    ? getDisplayedGridStepM({
        stepM,
        dynamic,
        pxPerMeter: getPxPerMeter({ zoom, basePoseK, meterByPx }),
      })
    : null;

  // render

  if (!displayedStepM) return null;

  return (
    <Typography
      sx={{
        fontSize: "10px",
        lineHeight: 1.2,
        color: "text.secondary",
        textShadow: "0px 0px 2px white",
        userSelect: "none",
      }}
    >
      {`${cellS} : ${formatGridStep(displayedStepM)}`}
    </Typography>
  );
}
