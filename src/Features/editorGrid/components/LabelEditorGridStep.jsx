import { Typography } from "@mui/material";

import useMapZoom from "Features/mapEditorGeneric/hooks/useMapZoom";
import useEditorGrid from "../hooks/useEditorGrid";

import getDisplayedGrid, { getPxPerMeter } from "../utils/getDisplayedGrid";
import formatGridStep from "../utils/formatGridStep";

// Small caption of the dynamic editor grid: the size of one cell (and of the
// main grid, thicker lines), which change with the zoom level. Shown next to the scale indicator (bottom
// left of the 2D editor); nothing in fixed mode, where the cell size is the
// one picked in the « Grille » menu.
export default function LabelEditorGridStep({ meterByPx, basePoseK = 1 }) {
  // strings

  const cellS = "Maille";
  const mainS = "trait fort";

  // data

  const { enabled, stepM, dynamic } = useEditorGrid();
  const active = enabled && dynamic;
  const zoom = useMapZoom(active);

  // helpers

  const grid = active
    ? getDisplayedGrid({
        stepM,
        dynamic,
        pxPerMeter: getPxPerMeter({ zoom, basePoseK, meterByPx }),
      })
    : null;

  // render

  if (!grid) return null;

  let label = `${cellS} : ${formatGridStep(grid.stepM)}`;
  if (grid.majorEvery > 1) {
    label += ` · ${mainS} : ${formatGridStep(grid.stepM * grid.majorEvery)}`;
  }

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
      {label}
    </Typography>
  );
}
