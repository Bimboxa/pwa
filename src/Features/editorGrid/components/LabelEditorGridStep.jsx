import { Typography } from "@mui/material";

import useMapCameraSelector from "Features/mapEditorGeneric/hooks/useMapCamera";
import useEditorGrid from "../hooks/useEditorGrid";

import getDisplayedGrid, { getPxPerMeter } from "../utils/getDisplayedGrid";
import formatGridStep from "../utils/formatGridStep";

// Small caption of the dynamic editor grid: the size of one cell (and of the
// main grid, thicker lines), which change with the zoom level — live, during
// the zoom gesture, like the grid itself. Shown next to the scale indicator (bottom
// left of the 2D editor); nothing in fixed mode, where the cell size is the
// one picked in the « Grille » menu.
export default function LabelEditorGridStep({ meterByPx, basePoseK = 1 }) {
  // strings

  const cellS = "Maille";
  const mainS = "trait fort";

  // data

  const { enabled, stepM, dynamic } = useEditorGrid();
  const active = enabled && dynamic;

  // The selected value is the label itself (a string): re-render only when
  // the text changes.
  const label = useMapCameraSelector((camera) => {
    const grid = getDisplayedGrid({
      stepM,
      dynamic,
      pxPerMeter: getPxPerMeter({ zoom: camera.k, basePoseK, meterByPx }),
    });
    if (!grid) return null;
    let text = `${cellS} : ${formatGridStep(grid.stepM)}`;
    if (grid.majorEvery > 1) {
      text += ` · ${mainS} : ${formatGridStep(grid.stepM * grid.majorEvery)}`;
    }
    return text;
  }, active);

  // render

  if (!label) return null;

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
