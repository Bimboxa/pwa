import { IconButton, Paper, Tooltip } from "@mui/material";
import TerrainIcon from "@mui/icons-material/Terrain";

import useCursorAltitudeToggle from "Features/mapEditor/hooks/useCursorAltitudeToggle";

// Bottom-left toggle of the altimetry under the cursor (2D editor): the
// altitude of the hovered annotation / scan follows the pointer.
export default function ButtonToggleCursorAltitude() {
  // strings

  const tooltipS = "Altimétrie sous le curseur";

  // data

  const { enabled, toggle } = useCursorAltitudeToggle();

  // render

  return (
    <Tooltip title={tooltipS} placement="right">
      <Paper elevation={2} sx={{ borderRadius: 1 }}>
        <IconButton
          size="small"
          onClick={toggle}
          color={enabled ? "primary" : "default"}
          sx={{ bgcolor: enabled ? "action.selected" : undefined }}
        >
          <TerrainIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Tooltip>
  );
}
