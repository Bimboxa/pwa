import { IconButton, Paper, Tooltip } from "@mui/material";
import TerrainIcon from "@mui/icons-material/Terrain";

import useCursorAltitudeToggle from "Features/mapEditor/hooks/useCursorAltitudeToggle";

// Bottom-left toggle of the altimetry under the cursor (2D and 3D editors,
// one shared device preference): the altitude of the hovered annotation /
// scan / surface follows the pointer.
export default function ButtonToggleCursorAltitude() {
  // strings

  const tooltipS = "Altimétrie sous le curseur";

  // data

  const { enabled, toggle } = useCursorAltitudeToggle();

  // render

  return (
    <Tooltip title={tooltipS} placement="right">
      <Paper
        elevation={2}
        sx={{
          borderRadius: "8px",
          display: "inline-flex",
          width: 40,
          height: 40,
          p: 0.5,
          boxSizing: "border-box",
        }}
      >
        <IconButton
          onClick={toggle}
          color={enabled ? "primary" : "default"}
          aria-label={tooltipS}
          aria-pressed={enabled}
          sx={{ bgcolor: enabled ? "action.selected" : undefined }}
        >
          <TerrainIcon />
        </IconButton>
      </Paper>
    </Tooltip>
  );
}
